import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from redis.exceptions import RedisError
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from app.collector.runner import Collector
from app.collector.state import MachineRuntime
from app.collector.storage import persist_runtimes
from app.models import Machine, MachineCheckpoint, MachineTelemetry, ProductionRun
from app.seed import seed
from app.services.modbus import Endpoint, Registers
from app.services.telemetry import base_measurements, measurement, register_blocks

SIMULATOR_PATH = Path(__file__).resolve().parents[2] / "simulator"


def variable(code="fill", address=9, data_type="float32", **changes):
    return dict(
        code=code,
        unit="s",
        address=address,
        data_type=data_type,
        word_order="big",
        byte_order="big",
        scale=1,
        offset=0,
        map_version="injection-demo-v1",
        **changes,
    )


@pytest.mark.parametrize(
    "word_order,byte_order,words",
    [
        ("big", "big", [0x41A0, 0]),
        ("little", "big", [0, 0x41A0]),
        ("big", "little", [0xA041, 0]),
        ("little", "little", [0, 0xA041]),
    ],
)
def test_process_float_byte_and_word_orders(word_order, byte_order, words):
    mapping = variable()
    mapping.update(word_order=word_order, byte_order=byte_order)
    result = measurement(mapping, words)
    assert result["value"] == 20 and result["quality"] == "good"
    assert result["mapping"]["map_version"] == "injection-demo-v1"


def test_optional_blocks_preserve_holes_and_protocol_limit():
    mappings = [variable(f"v{i}", 9 + i * 2) for i in range(64)]
    blocks = register_blocks([*mappings, variable("far", 400)])
    assert [(left, right) for left, right, _ in blocks] == [(9, 133), (133, 137), (400, 402)]


async def test_failed_optional_block_is_bad_and_core_reads_keep_working():
    class Client:
        connected = True

        def __init__(self):
            self.calls = []

        async def read_holding_registers(self, address, *, count, device_id):
            self.calls.append((address, count, device_id))
            if address == 9:
                return SimpleNamespace(isError=lambda: True)
            words = [1, 0, 44, 0, 4, 0, 200, 9, 200] if address == 0 else [0x41A0, 0]
            return SimpleNamespace(isError=lambda: False, registers=words)

    client = Client()
    endpoint = Endpoint("test", 5020, client=client)
    values = await endpoint.read_variables(
        1, [variable(), variable("dose", 11), variable("far", 100)]
    )
    assert values["fill"]["value"] is None and values["dose"]["quality"] == "bad"
    assert values["far"]["value"] == 20
    assert client.calls[:2] == [(9, 4, 1), (100, 2, 1)]
    assert (await endpoint.read(1)).good_count == 44
    assert endpoint.connection_failures == 0 and endpoint.unit_retry == {}


async def test_optional_timeout_releases_endpoint_lock_for_core_read():
    class Client:
        connected = True

        async def read_holding_registers(self, address, *, count, device_id):
            if address:
                await asyncio.Event().wait()
            return SimpleNamespace(
                isError=lambda: False, registers=[1, 0, 44, 0, 4, 0, 200, 9, 200]
            )

    endpoint = Endpoint("test", 5020, client=Client())
    values = await asyncio.wait_for(endpoint.read_variables(1, [variable()]), timeout=3)
    assert values["fill"]["quality"] == "bad"
    assert not endpoint.lock.locked()
    assert (await endpoint.read(1)).good_count == 44


async def test_short_optional_response_is_bad_not_an_invented_zero():
    client = SimpleNamespace(connected=True)

    async def read(*args, **kwargs):
        return SimpleNamespace(isError=lambda: False, registers=[0])

    client.read_holding_registers = read
    values = await Endpoint("test", 5020, client=client).read_variables(1, [variable()])
    assert values["fill"]["quality"] == "bad" and values["fill"]["value"] is None


async def seeded_machine(session, now):
    await seed(session, days=0, now=now)
    return await session.scalar(select(Machine).where(Machine.unit_id == 1))


async def test_telemetry_acquisition_selects_historical_run_across_restart(db_session):
    now = datetime(2026, 10, 21, 18, tzinfo=UTC)
    machine = await seeded_machine(db_session, now)
    first = await db_session.scalar(
        select(ProductionRun).where(ProductionRun.machine_id == machine.id)
    )
    boundary = now + timedelta(seconds=5)
    first.ended_at = boundary
    await db_session.flush()
    second = ProductionRun(
        plant_id=first.plant_id,
        order_id=first.order_id,
        machine_id=machine.id,
        mold_id=first.mold_id,
        context=first.context,
        nominal_cavities=4,
        active_cavities=2,
        ideal_cycle_s=20,
        part_weight_g=first.part_weight_g,
        started_at=boundary,
    )
    db_session.add(second)
    await db_session.commit()
    previous = MachineRuntime(machine.id)
    registers = Registers(1, 100, 4, 0, 200, 1, 200)
    previous.observe(registers, now + timedelta(seconds=1))
    previous.telemetry.append(
        dict(
            machine_id=machine.id,
            sampled_at=previous.accounted_at,
            source="modbus",
            values=base_measurements(registers),
        )
    )
    await persist_runtimes(db_session, [previous])
    await db_session.commit()
    restored = MachineRuntime(machine.id)
    restored.restore_gap(previous.checkpoint(), now + timedelta(seconds=10))
    restored.observe(registers, now + timedelta(seconds=11))
    restored.telemetry.append(
        dict(
            machine_id=machine.id,
            sampled_at=restored.accounted_at,
            source="modbus",
            values=base_measurements(registers),
        )
    )
    await persist_runtimes(db_session, [restored])
    await db_session.commit()
    frames = list(
        await db_session.scalars(select(MachineTelemetry).order_by(MachineTelemetry.sampled_at))
    )
    assert [frame.run_id for frame in frames] == [first.id, second.id]
    assert len(frames) == 2  # No fabricated process frames inside the crash gap.
    assert restored.samples == []  # Restart establishes a fresh production baseline.


async def test_collector_keeps_buffer_after_sql_failure_and_clears_after_commit_even_if_redis_fails(
    db_session, monkeypatch
):
    now = datetime(2026, 10, 21, 18, tzinfo=UTC)
    machine = await seeded_machine(db_session, now)
    collector = Collector()
    await collector.redis.aclose()

    class BrokenRedis:
        def pipeline(self, **kwargs):
            raise RedisError("isolated test outage")

    collector.redis = BrokenRedis()
    collector.machines[machine.id] = machine
    runtime = collector.runtimes[machine.id] = MachineRuntime(machine.id)
    registers = Registers(1, 100, 4, 0, 200, 1, 200)
    runtime.observe(registers, now + timedelta(seconds=1))
    runtime.telemetry.append(
        dict(
            machine_id=machine.id,
            sampled_at=runtime.accounted_at,
            source="modbus",
            values=base_measurements(registers),
        )
    )

    @asynccontextmanager
    async def sessions():
        try:
            yield db_session
        except BaseException:
            await db_session.rollback()
            raise

    monkeypatch.setattr("app.collector.runner.SessionLocal", sessions)
    commit = db_session.commit

    async def fail():
        raise SQLAlchemyError("isolated commit failure")

    monkeypatch.setattr(db_session, "commit", fail)
    with pytest.raises(SQLAlchemyError):
        await collector.flush()
    assert len(runtime.telemetry) == 1
    assert await db_session.scalar(select(func.count()).select_from(MachineTelemetry)) == 0
    monkeypatch.setattr(db_session, "commit", commit)
    await collector.flush()
    assert runtime.telemetry == []
    assert await db_session.scalar(select(func.count()).select_from(MachineTelemetry)) == 1
    assert await db_session.get(MachineCheckpoint, runtime.machine_id) is not None


async def test_real_modbus_process_values_are_persisted_as_pieces_with_demo_provenance(
    db_session, tmp_path
):
    import socket
    import sys

    import yaml

    simulator = SIMULATOR_PATH
    sys.path.insert(0, str(simulator))
    from oee_simulator.main import create_app

    from app.models import MachineVariable
    from app.services.telemetry import mapping_data

    config = yaml.safe_load((simulator / "machines.yaml").read_text(encoding="utf-8"))
    for profile in config["machines"]:
        profile.update(
            ideal_cycle_s=0.1,
            cycle_jitter=0,
            scrap_rate=0.25,
            mtbf_min=1e20,
            micro_stop_prob=0,
            idle_prob=0,
        )
    config_path = tmp_path / "injection.yaml"
    config_path.write_text(yaml.safe_dump(config), encoding="utf-8")
    await seed(db_session, days=0, config_path=config_path)
    machine = await db_session.scalar(select(Machine).where(Machine.unit_id == 1))
    mappings = [
        mapping_data(row)
        for row in await db_session.scalars(
            select(MachineVariable).where(MachineVariable.machine_id == machine.id)
        )
    ]
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    application = create_app(config_path, modbus_host="127.0.0.1", modbus_port=port, seed=42)
    collector = Collector()
    try:
        async with application.router.lifespan_context(application):
            machine.host, machine.port = "127.0.0.1", port
            runtime = collector.runtimes[machine.id] = MachineRuntime(machine.id)
            collector.variables[machine.id] = mappings
            await collector.poll_machine(machine)
            application.state.simulation.machines[1].advance(0.2)
            application.state.simulation.write(1)
            await collector.poll_machine(machine)
            assert sum(sample["good"] + sample["reject"] for sample in runtime.samples) >= 8
            assert all((sample["good"] + sample["reject"]) % 4 == 0 for sample in runtime.samples)
            await persist_runtimes(db_session, [runtime])
            await db_session.commit()
            frame = await db_session.scalar(
                select(MachineTelemetry)
                .where(MachineTelemetry.machine_id == machine.id)
                .order_by(MachineTelemetry.sampled_at.desc())
            )
            assert frame.run_id is not None and frame.source == "modbus"
            for code in (
                "filling_time_s",
                "dose_time_s",
                "min_cushion_position",
                "vp_switchover_position",
                "peak_injection_pressure",
                "melt_temperature_c",
            ):
                assert frame.values[code]["quality"] == "good"
                assert frame.values[code]["value"] > 0
                assert frame.values[code]["mapping"]["map_version"] == "injection-demo-v1"
            assert frame.values["active_cavities"]["value"] == 4
            assert frame.values["cycle_time_s"]["unit"] == "s"
            # Stop reading frozen process values as current data when the heartbeat stalls.
            application.state.simulation.machines[1].disconnect(60)
            frozen = await collector.pool.read(machine.host, machine.port, machine.unit_id)
            runtime.last_heartbeat = frozen.heartbeat
            runtime.heartbeat_changed_at = datetime.now(UTC) - timedelta(seconds=6)
            await collector.poll_machine(machine)
            assert runtime.state == "OFFLINE"
            assert runtime.telemetry[-1]["values"]["peak_injection_pressure"]["quality"] == "stale"
    finally:
        collector.pool.close()
        await collector.redis.aclose()
