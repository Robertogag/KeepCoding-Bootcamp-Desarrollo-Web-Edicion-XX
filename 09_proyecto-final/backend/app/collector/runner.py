import asyncio
import json
import logging
import signal
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import select, text, update
from sqlalchemy.exc import SQLAlchemyError

from app.collector.state import MachineRuntime, iso
from app.collector.storage import persist_runtimes
from app.config import settings
from app.db import SessionLocal, engine
from app.models import Machine, MachineCheckpoint, MachineEvent, MachineVariable
from app.services.alerts import evaluate_alerts
from app.services.modbus import ModbusPool, ModbusReadError
from app.services.oee import oee_today
from app.services.telemetry import base_measurements, mapping_data, measurement

logger = logging.getLogger(__name__)
POLL_SECONDS = 1.0
RELOAD_SECONDS = 30.0
PUBLISH_SECONDS = 2.0
COLLECTOR_LOCK = 1330791766


@asynccontextmanager
async def single_collector():
    """A session advisory lock prevents two replicas from double-counting production."""
    if engine.dialect.name != "postgresql":
        yield
        return
    async with engine.connect() as connection:
        acquired = await connection.scalar(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": COLLECTOR_LOCK}
        )
        await connection.commit()
        if not acquired:
            raise RuntimeError("Another collector already owns this database")
        try:
            yield
        finally:
            await connection.execute(
                text("SELECT pg_advisory_unlock(:key)"), {"key": COLLECTOR_LOCK}
            )
            await connection.commit()


class Collector:
    def __init__(self):
        self.redis = Redis.from_url(
            settings.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
        )
        self.pool = ModbusPool()
        self.machines: dict[int, Machine] = {}
        self.runtimes: dict[int, MachineRuntime] = {}
        self.variables: dict[int, list[dict]] = {}
        self.stop = asyncio.Event()
        self.last_reload = float("-inf")
        self.reload_retry_at = 0.0
        self.last_publish = float("-inf")

    async def refresh_machines(self) -> None:
        now = datetime.now(UTC)
        async with SessionLocal() as session:
            machines = {
                machine.id: machine
                for machine in (
                    await session.scalars(select(Machine).where(Machine.is_active.is_(True)))
                )
            }
            events = {
                event.machine_id: event
                for event in (
                    await session.scalars(
                        select(MachineEvent).where(MachineEvent.ended_at.is_(None)),
                    )
                )
            }
            variables = {}
            for variable in await session.scalars(
                select(MachineVariable).where(
                    MachineVariable.is_active.is_(True), MachineVariable.machine_id.in_(machines)
                )
            ):
                variables.setdefault(variable.machine_id, []).append(mapping_data(variable))
            checkpoints = {
                checkpoint.machine_id: checkpoint.progress
                for checkpoint in await session.scalars(
                    select(MachineCheckpoint).where(
                        MachineCheckpoint.machine_id.in_(machines),
                    )
                )
            }
            removed = set(self.machines) - set(machines)
            for machine_id in removed:
                self.runtimes[machine_id].account_until(now)
                self.runtimes[machine_id].change_state("OFFLINE", now)
            if removed:
                await persist_runtimes(session, [self.runtimes[mid] for mid in removed])
                await session.execute(
                    update(MachineEvent)
                    .where(
                        MachineEvent.machine_id.in_(removed),
                        MachineEvent.ended_at.is_(None),
                    )
                    .values(ended_at=now)
                )
                await session.commit()

        for machine_id in removed:
            self.runtimes.pop(machine_id)
            try:
                await self.redis.delete(
                    f"machine:{machine_id}:snapshot", f"machine:{machine_id}:collector"
                )
            except RedisError:
                logger.exception("Could not evict inactive machine %s from Redis", machine_id)

        added = set(machines) - set(self.machines)
        restored = {
            machine_id: checkpoints[machine_id] for machine_id in added if machine_id in checkpoints
        }
        needs_cache = added - set(restored)
        if needs_cache:
            try:
                identifiers = sorted(needs_cache)
                values = await self.redis.mget([f"machine:{mid}:collector" for mid in identifiers])
                restored.update(zip(identifiers, values, strict=True))
            except RedisError:
                logger.exception("Could not restore collector checkpoints; using fresh baselines")

        for machine_id, machine in machines.items():
            old = self.machines.get(machine_id)
            if machine_id in added:
                event = events.get(machine_id)
                runtime = MachineRuntime(
                    machine_id,
                    state=event.state if event else None,
                    since=event.started_at if event else None,
                    accounted_at=now,
                )
                if raw := restored.get(machine_id):
                    try:
                        checkpoint = json.loads(raw) if isinstance(raw, str) else raw
                        runtime.restore_display(checkpoint)
                        runtime.restore_gap(checkpoint, now)
                    except (ValueError, TypeError, AttributeError):
                        logger.warning("Ignoring invalid checkpoint for machine %s", machine_id)
                self.runtimes[machine_id] = runtime
            elif (old.host, old.port, old.unit_id) != (machine.host, machine.port, machine.unit_id):
                runtime = self.runtimes[machine_id]
                runtime.baseline_good = runtime.baseline_reject = None
                runtime.last_heartbeat = runtime.heartbeat_changed_at = None
                runtime.failures = 0
        self.machines = machines
        self.variables = variables
        self.pool.retain({(machine.host, machine.port) for machine in machines.values()})
        self.last_reload = time.monotonic()
        logger.info("Loaded %d active machines", len(machines))

    async def poll_machine(self, machine: Machine) -> None:
        runtime = self.runtimes[machine.id]
        previous_state = runtime.state
        try:
            registers = await self.pool.read(machine.host, machine.port, machine.unit_id)
        except ModbusReadError as exc:
            logger.debug("Machine %s read failed: %s", machine.id, exc)
            registers = None
        runtime.observe(registers, datetime.now(UTC))
        mappings = self.variables.get(machine.id, [])
        values = base_measurements(registers, stale=runtime.state == "OFFLINE")
        optional = (
            await self.pool.read_variables(machine.host, machine.port, machine.unit_id, mappings)
            if registers is not None
            else {m["code"]: measurement(m) for m in mappings}
        )
        if runtime.state == "OFFLINE" and registers is not None:
            for value in optional.values():
                if value["quality"] == "good":
                    value["quality"] = "stale"
        runtime.telemetry.append(
            {
                "machine_id": machine.id,
                "sampled_at": runtime.accounted_at,
                "source": "modbus",
                "values": {**values, **optional},
            }
        )
        if runtime.state != previous_state:
            logger.info("Machine %s: %s -> %s", machine.id, previous_state, runtime.state)

    async def flush(self) -> None:
        runtimes = list(self.runtimes.values())
        async with SessionLocal() as session:
            existing = await persist_runtimes(session, runtimes)
            await session.commit()
        for runtime in runtimes:
            runtime.persisted()
            if runtime.machine_id not in existing:
                self.runtimes.pop(runtime.machine_id, None)
                self.machines.pop(runtime.machine_id, None)
        # Commit precedes the checkpoint. Redis outages must not discard database telemetry.
        try:
            async with self.redis.pipeline(transaction=True) as pipeline:
                for runtime in self.runtimes.values():
                    pipeline.set(
                        f"machine:{runtime.machine_id}:collector", json.dumps(runtime.checkpoint())
                    )
                await pipeline.execute()
        except RedisError:
            logger.exception("Could not checkpoint committed telemetry")

    async def publish(self) -> None:
        now = datetime.now(UTC)
        snapshots = {}
        async with SessionLocal() as session:
            for machine_id, machine in self.machines.items():
                runtime = self.runtimes[machine_id]
                snapshot = runtime.snapshot(await oee_today(session, machine))
                await evaluate_alerts(session, machine, snapshot, now)
                snapshots[machine_id] = snapshot
            await session.commit()

        async with self.redis.pipeline(transaction=True) as pipeline:
            # OEE queries and alert persistence may take time. This timestamp marks
            # the completed durable work being published, not the start of that work.
            published_at = iso(datetime.now(UTC))
            for machine_id, snapshot in snapshots.items():
                machine = self.machines[machine_id]
                pipeline.set(f"machine:{machine_id}:snapshot", json.dumps(snapshot))
                pipeline.set(
                    f"machine:{machine_id}:collector",
                    json.dumps(self.runtimes[machine_id].checkpoint()),
                )
                pipeline.publish(
                    f"plant:{machine.plant_id}:live",
                    json.dumps(
                        {
                            "type": "machine.snapshot",
                            "plant_id": machine.plant_id,
                            "machine_id": machine_id,
                            "snapshot": snapshot,
                            "ts": published_at,
                        }
                    ),
                )
            pipeline.set("collector:heartbeat", published_at, ex=10)
            await pipeline.execute()
        self.last_publish = time.monotonic()

    async def run(self) -> None:
        try:
            async with single_collector():
                while not self.stop.is_set():
                    started = time.monotonic()
                    try:
                        if (
                            started - self.last_reload >= RELOAD_SECONDS
                            and started >= self.reload_retry_at
                        ):
                            try:
                                await self.refresh_machines()
                            except (SQLAlchemyError, OSError):
                                # Keep reading the known machine set while the DB is unavailable.
                                self.reload_retry_at = started + 5
                                logger.exception("Machine reload failed; retaining current devices")
                        await asyncio.gather(
                            *(
                                self.poll_machine(machine)
                                for machine in list(self.machines.values())
                            )
                        )
                        await self.flush()
                        if time.monotonic() - self.last_publish >= PUBLISH_SECONDS:
                            await self.publish()
                    except (SQLAlchemyError, RedisError, OSError):
                        # Keep buffered telemetry until its transaction has committed.
                        logger.exception("Collector cycle failed; retrying with buffered telemetry")
                    delay = max(0.01, POLL_SECONDS - (time.monotonic() - started))
                    try:
                        await asyncio.wait_for(self.stop.wait(), timeout=delay)
                    except TimeoutError:
                        pass
                now = datetime.now(UTC)
                for runtime in self.runtimes.values():
                    runtime.account_until(now)
                    runtime.change_state("OFFLINE", now)
                await self.flush()
                await self.publish()
        finally:
            self.pool.close()
            await self.redis.aclose()
            await engine.dispose()


async def main() -> None:
    collector = Collector()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, collector.stop.set)
        except NotImplementedError:
            signal.signal(sig, lambda *_: loop.call_soon_threadsafe(collector.stop.set))
    await collector.run()
