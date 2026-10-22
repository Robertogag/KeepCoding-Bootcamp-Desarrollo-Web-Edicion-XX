import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fakeredis.aioredis import FakeRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.collector.state import MachineRuntime
from app.collector.storage import persist_runtimes
from app.db import Base
from app.models import (
    Machine,
    MachineCheckpoint,
    MachineEvent,
    Plant,
    ProductionMinute,
    ProductionSample,
)
from app.services.modbus import Registers


def reading(heartbeat=1, good=20, state=1, alarm=0):
    return Registers(state, good, 3, alarm, 100, heartbeat, 100)


async def test_slow_oee_publishes_fresh_heartbeat_after_commit_without_retiming_observations(
    monkeypatch,
):
    from app.collector import runner
    from app.collector.health import evaluate_heartbeat

    start = datetime(2026, 10, 22, 4, tzinfo=UTC)
    steps = []

    class Clock:
        current = start

        @classmethod
        def now(cls, zone):
            return cls.current.astimezone(zone)

    async with FakeRedis(decode_responses=True) as cache:

        class Session:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *_):
                Clock.current += timedelta(seconds=2)

            async def commit(self):
                assert await cache.get("collector:heartbeat") is None
                steps.append("commit")
                Clock.current += timedelta(seconds=3)

        async def slow_oee(session, machine):
            assert await cache.get("collector:heartbeat") is None
            steps.append("oee")
            Clock.current += timedelta(seconds=25)
            return dict(availability=1, performance=0.9, quality=1, oee=0.9)

        async def alerts(session, machine, snapshot, now):
            assert now == start
            steps.append("alerts")

        monkeypatch.setattr(runner, "datetime", Clock)
        monkeypatch.setattr(runner, "SessionLocal", Session)
        monkeypatch.setattr(runner, "oee_today", slow_oee)
        monkeypatch.setattr(runner, "evaluate_alerts", alerts)
        collector = runner.Collector()
        await collector.redis.aclose()
        collector.redis = cache
        collector.machines[1] = SimpleNamespace(id=1, plant_id=1)
        runtime = collector.runtimes[1] = MachineRuntime(1)
        runtime.observe(reading(), start)

        async with cache.pubsub() as subscriber:
            await subscriber.subscribe("plant:1:live")
            await subscriber.get_message(timeout=1)  # Consume subscription acknowledgement.
            await collector.publish()
            message = await subscriber.get_message(ignore_subscribe_messages=True, timeout=1)

        heartbeat = await cache.get("collector:heartbeat")
        assert steps == ["oee", "alerts", "commit"]
        assert datetime.fromisoformat(heartbeat) == start + timedelta(seconds=30)
        assert evaluate_heartbeat(heartbeat, Clock.current) == {
            "status": "healthy",
            "age_seconds": 0.0,
        }
        assert await cache.ttl("collector:heartbeat") in (9, 10)
        assert json.loads(message["data"])["ts"] == heartbeat
        checkpoint = json.loads(await cache.get("machine:1:collector"))
        snapshot = json.loads(await cache.get("machine:1:snapshot"))
        assert datetime.fromisoformat(checkpoint["accounted_at"]) == start
        assert datetime.fromisoformat(snapshot["since"]) == start
        assert runtime.accounted_at == runtime.since == start


def test_three_failed_reads_become_offline_and_recovery_preserves_counter_delta():
    now = datetime(2026, 10, 21, tzinfo=UTC)
    runtime = MachineRuntime(1)
    runtime.observe(reading(), now)
    for second in (1, 2):
        runtime.observe(None, now + timedelta(seconds=second))
        assert runtime.state == "RUNNING"
    runtime.observe(None, now + timedelta(seconds=3))
    assert runtime.state == "OFFLINE"
    assert runtime.since == now + timedelta(seconds=3)
    assert runtime.good == 20
    runtime.observe(reading(heartbeat=7, good=23), now + timedelta(seconds=6))
    assert runtime.state == "RUNNING"
    assert runtime.samples[0]["good"] == 3
    minute = next(iter(runtime.minutes.values()))
    assert minute.run_s == 3
    assert minute.offline_s == 3
    assert [transition.state for transition in runtime.transitions] == [
        "RUNNING",
        "OFFLINE",
        "RUNNING",
    ]


def test_stalled_heartbeat_and_wrap_recovery():
    now = datetime(2026, 10, 21, tzinfo=UTC)
    runtime = MachineRuntime(1)
    runtime.observe(reading(heartbeat=65535), now)
    runtime.observe(reading(heartbeat=65535), now + timedelta(seconds=4, milliseconds=999))
    assert runtime.state == "RUNNING"
    runtime.observe(reading(heartbeat=65535), now + timedelta(seconds=5))
    assert runtime.state == "OFFLINE"
    runtime.observe(reading(heartbeat=0), now + timedelta(seconds=6))
    assert runtime.state == "RUNNING"


def test_all_elapsed_time_is_split_at_minute_boundaries_with_correct_previous_state():
    now = datetime(2026, 10, 21, 12, 0, 59, 250000, tzinfo=UTC)
    runtime = MachineRuntime(1)
    runtime.observe(reading(), now)
    runtime.observe(reading(heartbeat=2, state=2, alarm=99), now + timedelta(seconds=62))
    minutes = sorted(runtime.minutes.values(), key=lambda minute: minute.bucket_start)
    assert [minute.run_s for minute in minutes] == [0.75, 60, 1.25]
    assert sum(minute.down_s for minute in minutes) == 0
    assert runtime.transitions[-1].reason_code == "99"


def test_same_state_does_not_reopen_events_and_restart_only_restores_display():
    now = datetime(2026, 10, 21, tzinfo=UTC)
    runtime = MachineRuntime(1)
    runtime.observe(reading(), now)
    runtime.observe(reading(heartbeat=2), now + timedelta(seconds=1))
    assert len(runtime.transitions) == 1
    restored = MachineRuntime(1, state=runtime.state, since=runtime.since)
    restored.restore_display(runtime.checkpoint())
    assert restored.good == 20
    restored.observe(reading(heartbeat=9, good=900), now + timedelta(hours=1))
    assert restored.samples == []
    assert restored.since == now


def test_restart_marks_unobserved_gap_offline_from_last_checkpoint():
    now = datetime(2026, 10, 21, tzinfo=UTC)
    previous = MachineRuntime(1)
    previous.observe(reading(), now)
    previous.observe(reading(heartbeat=2), now + timedelta(seconds=1))
    restored = MachineRuntime(1, state=previous.state, since=previous.since)
    restored.restore_gap(previous.checkpoint(), now + timedelta(seconds=20))
    assert restored.state == "OFFLINE"
    assert restored.since == now + timedelta(seconds=1)
    assert sum(minute.offline_s for minute in restored.minutes.values()) == 19
    assert sum(minute.run_s for minute in restored.minutes.values()) == 0
    restored.observe(reading(heartbeat=10, good=1000), now + timedelta(seconds=21))
    assert restored.state == "RUNNING" and restored.samples == []


@pytest.mark.asyncio
async def test_batch_persistence_upserts_minutes_and_closes_events_transactionally():
    database = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with database.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        sessions = async_sessionmaker(database, expire_on_commit=False)
        async with sessions() as session:
            plant = Plant(name="Test", slug="test", timezone="UTC", is_public=True)
            session.add(plant)
            await session.flush()
            machine = Machine(
                plant_id=plant.id,
                name="Test",
                slug="test",
                host="127.0.0.1",
                port=5020,
                unit_id=1,
                ideal_cycle_s=10,
                is_active=True,
            )
            session.add(machine)
            await session.commit()
            machine_id = machine.id
        now = datetime(2026, 10, 21, 12, 0, 58, tzinfo=UTC)
        runtime = MachineRuntime(machine_id)
        runtime.observe(reading(), now)
        runtime.observe(reading(heartbeat=2, good=22), now + timedelta(seconds=1))
        async with sessions() as session:
            await persist_runtimes(session, [runtime])
            await session.commit()
        runtime.persisted()
        runtime.observe(
            reading(heartbeat=3, good=23, state=2, alarm=97), now + timedelta(seconds=3)
        )
        async with sessions() as session:
            await persist_runtimes(session, [runtime])
            await session.commit()
        runtime.persisted()
        async with sessions() as session:
            events = list(
                (
                    await session.scalars(select(MachineEvent).order_by(MachineEvent.started_at))
                ).all()
            )
            minutes = list(
                (
                    await session.scalars(
                        select(ProductionMinute).order_by(ProductionMinute.bucket_start)
                    )
                ).all()
            )
            samples = list(
                (
                    await session.scalars(
                        select(ProductionSample).order_by(ProductionSample.sampled_at)
                    )
                ).all()
            )
        assert [(event.state, event.reason_code) for event in events] == [
            ("RUNNING", None),
            ("DOWN", "97"),
        ]
        assert events[0].ended_at == now + timedelta(seconds=3)
        assert events[1].ended_at is None
        assert [minute.run_s for minute in minutes] == [2, 1]
        assert [minute.good for minute in minutes] == [2, 1]
        assert [sample.good for sample in samples] == [2, 1]
        assert runtime.minutes == {} and runtime.transitions == [] and runtime.samples == []
    finally:
        await database.dispose()


@pytest.mark.asyncio
async def test_checkpoint_is_atomic_and_recovers_crash_gap_without_redis():
    database = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with database.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        sessions = async_sessionmaker(database, expire_on_commit=False)
        async with sessions() as session:
            plant = Plant(name="Checkpoint", slug="checkpoint", timezone="UTC", is_public=True)
            session.add(plant)
            await session.flush()
            machine = Machine(
                plant_id=plant.id,
                name="Test",
                slug="test",
                host="127.0.0.1",
                port=5020,
                unit_id=1,
                ideal_cycle_s=10,
                is_active=True,
            )
            session.add(machine)
            await session.commit()
            machine_id = machine.id
        now = datetime(2026, 10, 21, 12, 0, 0, tzinfo=UTC)
        runtime = MachineRuntime(machine_id)
        runtime.observe(reading(good=1000), now)
        runtime.observe(reading(heartbeat=2, good=1003), now + timedelta(seconds=1))
        async with sessions() as session:
            await persist_runtimes(session, [runtime])
            await session.commit()
        runtime.persisted()
        runtime.observe(
            reading(heartbeat=3, good=1004, state=2, alarm=3), now + timedelta(seconds=2)
        )
        async with sessions() as session:
            await persist_runtimes(session, [runtime])
            await session.rollback()  # No partial checkpoint or new event may survive.
        async with sessions() as session:
            checkpoint = await session.get(MachineCheckpoint, machine_id)
            event = await session.scalar(
                select(MachineEvent).where(MachineEvent.ended_at.is_(None))
            )
            samples = list(await session.scalars(select(ProductionSample)))
            minutes = list(await session.scalars(select(ProductionMinute)))
        assert checkpoint.accounted_at == now + timedelta(seconds=1)
        assert checkpoint.snapshot["good"] == 1003
        assert event.state == "RUNNING" and event.started_at == now
        assert sum(sample.good for sample in samples) == 3
        assert sum(minute.good for minute in minutes) == 3
        assert sum(minute.run_s for minute in minutes) == 1

        # Emulate an abrupt process loss, including loss of Redis and unsaved in-memory buffers.
        restored = MachineRuntime(machine_id, state=event.state, since=event.started_at)
        restored.restore_display(checkpoint.snapshot)
        restored.restore_gap(checkpoint.progress, now + timedelta(seconds=11))
        assert restored.state == "OFFLINE" and restored.good == 1003
        restored.observe(reading(heartbeat=20, good=2000), now + timedelta(seconds=12))
        assert restored.samples == []  # Unobserved absolute growth is a fresh baseline.
        async with sessions() as session:
            await persist_runtimes(session, [restored])
            await session.commit()
        async with sessions() as session:
            checkpoint = await session.get(MachineCheckpoint, machine_id)
            events = list(
                await session.scalars(select(MachineEvent).order_by(MachineEvent.started_at))
            )
            minutes = list(await session.scalars(select(ProductionMinute)))
        assert checkpoint.snapshot["good"] == 2000
        assert checkpoint.accounted_at == now + timedelta(seconds=12)
        assert [event.state for event in events] == ["RUNNING", "OFFLINE", "RUNNING"]
        assert events[0].ended_at == now + timedelta(seconds=1)
        assert events[1].ended_at == now + timedelta(seconds=12)
        assert sum(minute.run_s for minute in minutes) == 1
        assert sum(minute.offline_s for minute in minutes) == 11
        assert sum(minute.good for minute in minutes) == 3
    finally:
        await database.dispose()
