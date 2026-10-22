"""Opt-in integration smoke: real PostgreSQL + Modbus, TCP Redis emulator.

Use a disposable database whose name starts with oee_collector_test:
COLLECTOR_SMOKE_DATABASE_URL=postgresql+asyncpg://.../oee_collector_test
Run with the backend's Python environment. Tables are created and removed here.
"""

# ruff: noqa: E402 -- Configure the disposable environment before importing app globals.

import asyncio
import json
import logging
import os
import socket
import sys
import tempfile
import threading
import time
from pathlib import Path

import httpx
import yaml
from fakeredis import TcpFakeServer
from fakeredis._clients._tcp_server import TCPFakeRequestHandler
from smoke_support import disposable_database, validate_database_url
from sqlalchemy import func, select

database_url = validate_database_url(os.environ["COLLECTOR_SMOKE_DATABASE_URL"])
os.environ["DATABASE_URL"] = database_url


class PortableFakeRedisHandler(TCPFakeRequestHandler):
    def setup(self):
        super().setup()
        # fakeredis 2.40 enables nonblocking reads only via POSIX fcntl by default.
        self.connection.setblocking(False)


fake_redis = TcpFakeServer(("127.0.0.1", 0), server_version=(7, 0))
fake_redis.RequestHandlerClass = PortableFakeRedisHandler
fake_redis.daemon_threads = True
os.environ["REDIS_URL"] = f"redis://127.0.0.1:{fake_redis.server_address[1]}/0"
threading.Thread(target=fake_redis.serve_forever, daemon=True).start()
project = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(project / "backend"), str(project / "simulator")]

from oee_simulator.main import create_app

from app.collector.runner import Collector, single_collector
from app.db import Base, SessionLocal, engine
from app.errors import ApiError
from app.models import (
    AlertRule,
    Machine,
    MachineEvent,
    Notification,
    Plant,
    PlantMember,
    ProductionMinute,
    ProductionSample,
    User,
)
from app.services.modbus import test_connection as connection_test


async def eventually(check, deadline_s=10):
    deadline = time.monotonic() + deadline_s
    while time.monotonic() < deadline:
        result = await check()
        if result:
            return result
        await asyncio.sleep(0.2)
    raise AssertionError("Integration condition did not become true")


async def run():
    logging.basicConfig(level=logging.WARNING)
    collector = Collector()
    collector_task = None
    try:
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            modbus_port = probe.getsockname()[1]
        async with SessionLocal() as session:
            plant = Plant(
                name="Collector smoke", slug="collector-smoke", timezone="UTC", is_public=True
            )
            user = User(
                username="collector-smoke",
                email="smoke@example.test",
                full_name="Smoke",
                password_hash="unused-test-account",
                language="es",
            )
            session.add_all([plant, user])
            await session.flush()
            machine = Machine(
                plant_id=plant.id,
                slug="machine",
                name="Smoke machine",
                host="127.0.0.1",
                port=modbus_port,
                unit_id=1,
                ideal_cycle_s=0.2,
                is_active=True,
            )
            session.add(machine)
            session.add(PlantMember(plant_id=plant.id, user_id=user.id, role="owner"))
            session.add(
                AlertRule(plant_id=plant.id, type="MACHINE_DOWN", duration_s=30, is_active=True)
            )
            await session.commit()
            machine_id, plant_id = machine.id, plant.id

        with tempfile.TemporaryDirectory(prefix="oee-simulator-") as directory:
            config = Path(directory) / "machines.yaml"
            config.write_text(
                yaml.safe_dump(
                    {
                        "machines": [
                            {
                                "unit_id": 1,
                                "name": "Smoke",
                                "ideal_cycle_s": 0.2,
                                "cycle_jitter": 0,
                                "scrap_rate": 0.1,
                                "mtbf_min": 1e20,
                                "mttr_min": 1,
                                "micro_stop_prob": 0,
                                "idle_prob": 0,
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            app = create_app(config, modbus_host="127.0.0.1", modbus_port=modbus_port, seed=42)
            async with app.router.lifespan_context(app):
                app.state.simulation.machines[1].good_count = 1000
                app.state.simulation.write(1)
                tested = await connection_test("127.0.0.1", modbus_port, 1)
                assert tested["ok"] and tested["registers"]["good_count"] == 1000
                try:
                    await connection_test("127.0.0.1", modbus_port, 99)
                except ApiError as exc:
                    assert exc.code == "MODBUS_UNREACHABLE" and exc.status == 502
                else:
                    raise AssertionError("Unknown unit must fail with MODBUS_UNREACHABLE")

                async with collector.redis.pubsub() as pubsub:
                    await pubsub.subscribe(f"plant:{plant_id}:live")
                    collector_task = asyncio.create_task(collector.run())

                    async def snapshot_is(state):
                        raw = await collector.redis.get(f"machine:{machine_id}:snapshot")
                        return raw and json.loads(raw)["state"] == state

                    await eventually(lambda: snapshot_is("RUNNING"))
                    try:
                        async with single_collector():
                            raise AssertionError("Second collector acquired the lock")
                    except RuntimeError as exc:
                        assert "Another collector" in str(exc)
                    print(
                        "PASS: TCP connection, baseline, Redis snapshot and singleton lock",
                        flush=True,
                    )
                    await asyncio.sleep(2.2)
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=2)
                    if message is None:
                        message = await pubsub.get_message(
                            ignore_subscribe_messages=True, timeout=2
                        )
                    assert json.loads(message["data"])["type"] == "machine.snapshot"

                    async with httpx.AsyncClient(
                        transport=httpx.ASGITransport(app=app), base_url="http://simulator"
                    ) as http:
                        await http.post(
                            "/machines/1/fault", json={"alarm_code": 3, "duration_s": 36}
                        )
                        await eventually(lambda: snapshot_is("DOWN"))

                        async def notification_exists():
                            async with SessionLocal() as session:
                                return await session.scalar(
                                    select(func.count()).select_from(Notification)
                                )

                        await eventually(notification_exists, deadline_s=35)
                        assert await notification_exists() == 1
                        print(
                            "PASS: persisted DOWN event and one alert after 30 actual seconds",
                            flush=True,
                        )
                        await eventually(lambda: snapshot_is("RUNNING"), deadline_s=10)
                        assert await notification_exists() == 1
                        await http.post("/machines/1/reset-counters")
                        await asyncio.sleep(2.2)
                        await http.post("/machines/1/disconnect", json={"duration_s": 8})
                        await eventually(lambda: snapshot_is("OFFLINE"), deadline_s=8)
                        offline = json.loads(
                            await collector.redis.get(f"machine:{machine_id}:snapshot")
                        )
                        assert offline["good"] < 1000
                        await eventually(lambda: snapshot_is("RUNNING"), deadline_s=8)
                        print(
                            "PASS: reset delta, frozen heartbeat OFFLINE and recovery", flush=True
                        )

                    collector.stop.set()
                    await collector_task
                    collector_task = None

        async with SessionLocal() as session:
            events = list(
                await session.scalars(select(MachineEvent).order_by(MachineEvent.started_at))
            )
            samples = list(await session.scalars(select(ProductionSample)))
            minutes = list(await session.scalars(select(ProductionMinute)))
            notifications = list(await session.scalars(select(Notification)))
        states = [event.state for event in events]
        assert states == ["RUNNING", "DOWN", "RUNNING", "OFFLINE", "RUNNING", "OFFLINE"]
        assert events[1].reason_code == "3"
        assert events[-1].ended_at is None and all(e.ended_at is not None for e in events[:-1])
        total = sum(sample.good + sample.reject for sample in samples)
        assert 0 < total < 200  # An absolute counter of 1000 was a baseline, never production.
        assert sum(sample.good for sample in samples) == sum(minute.good for minute in minutes)
        assert sum(sample.reject for sample in samples) == sum(minute.reject for minute in minutes)
        assert len(notifications) == 1 and notifications[0].type == "MACHINE_DOWN"
        print(
            json.dumps(
                {
                    "result": "PASS",
                    "database": "PostgreSQL 17 real",
                    "redis": "TCPFakeServer emulating Redis 7 (not real Redis)",
                    "modbus": "pymodbus 3.11.4 TCP real",
                    "events": states,
                    "production_samples": len(samples),
                    "pieces": total,
                    "notifications": len(notifications),
                }
            ),
            flush=True,
        )
    finally:
        try:
            if collector_task is not None:
                collector.stop.set()
                await collector_task
        finally:
            collector.pool.close()
            await collector.redis.aclose()


async def main():
    try:
        async with disposable_database(engine, Base.metadata):
            await run()
    finally:
        await engine.dispose()


try:
    asyncio.run(main())
finally:
    fake_redis.shutdown()
    fake_redis.server_close()
