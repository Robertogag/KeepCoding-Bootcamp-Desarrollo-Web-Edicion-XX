from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, event, func, select, text
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db import Base
from app.models import (
    AlertRule,
    Machine,
    MachineEvent,
    Notification,
    PasswordResetToken,
    Plant,
    PlantMember,
    ProductionMinute,
    ProductionSample,
    RefreshToken,
    User,
    Watchlist,
)


@pytest.fixture
async def model_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")

    @event.listens_for(engine.sync_engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


async def create_entities(session):
    user = User(
        username="demo", email="demo@example.com", full_name="Demo User", password_hash="hash"
    )
    plant = Plant(slug="plant", name="Plant", timezone="America/Mexico_City")
    session.add_all([user, plant])
    await session.flush()
    machine = Machine(
        plant_id=plant.id,
        slug="machine",
        name="Machine",
        host="simulator",
        ideal_cycle_s=1.5,
    )
    session.add(machine)
    await session.flush()
    return user, plant, machine


async def test_open_event_is_unique_per_machine(model_session):
    _, _, machine = await create_entities(model_session)
    model_session.add(
        MachineEvent(machine_id=machine.id, state="RUNNING", started_at=datetime.now(UTC))
    )
    await model_session.commit()
    model_session.add(
        MachineEvent(machine_id=machine.id, state="DOWN", started_at=datetime.now(UTC))
    )
    with pytest.raises(IntegrityError):
        await model_session.flush()


async def test_closed_events_and_unknown_alarm_are_preserved(model_session):
    _, _, machine = await create_entities(model_session)
    now = datetime.now(UTC)
    model_session.add_all(
        [
            MachineEvent(
                machine_id=machine.id,
                state="DOWN",
                reason_code="65535",
                started_at=now - timedelta(seconds=10),
                ended_at=now,
            ),
            MachineEvent(machine_id=machine.id, state="RUNNING", started_at=now),
        ]
    )
    await model_session.commit()
    model_session.expunge_all()
    events = (await model_session.scalars(select(MachineEvent).order_by(MachineEvent.id))).all()
    assert len(events) == 2
    assert events[0].reason_code == "65535"
    assert events[0].started_at.utcoffset() == timedelta(0)


async def test_user_delete_removes_personal_rows_and_anonymizes_event(model_session):
    user, plant, machine = await create_entities(model_session)
    user_id = user.id
    machine_id = machine.id
    now = datetime.now(UTC)
    model_session.add_all(
        [
            PlantMember(plant_id=plant.id, user_id=user.id, role="owner"),
            Watchlist(user_id=user.id, machine_id=machine.id),
            Notification(user_id=user.id, type="MACHINE_DOWN", payload={"machine_id": machine.id}),
            PasswordResetToken(token_hash="a" * 64, user_id=user.id, expires_at=now),
            RefreshToken(token_hash="b" * 64, user_id=user.id, family_id="family", expires_at=now),
            MachineEvent(
                machine_id=machine.id,
                state="DOWN",
                started_at=now,
                classified_by=user.id,
            ),
        ]
    )
    await model_session.commit()
    await model_session.execute(delete(User).where(User.id == user_id))
    await model_session.commit()
    model_session.expunge_all()
    for model in (PlantMember, Watchlist, Notification, PasswordResetToken, RefreshToken):
        assert await model_session.scalar(select(func.count()).select_from(model)) == 0
    event_row = await model_session.scalar(select(MachineEvent))
    assert event_row.classified_by is None
    assert await model_session.get(Machine, machine_id) is not None


async def test_plant_delete_cascades_to_production(model_session):
    user, plant, machine = await create_entities(model_session)
    now = datetime.now(UTC)
    model_session.add_all(
        [
            PlantMember(plant_id=plant.id, user_id=user.id, role="owner"),
            Watchlist(user_id=user.id, machine_id=machine.id),
            MachineEvent(machine_id=machine.id, state="IDLE", started_at=now),
            ProductionMinute(machine_id=machine.id, bucket_start=now, run_s=0.75, idle_s=0.25),
            ProductionSample(machine_id=machine.id, sampled_at=now, good=1),
            AlertRule(plant_id=plant.id, machine_id=machine.id, type="MACHINE_DOWN", duration_s=30),
        ]
    )
    await model_session.commit()
    await model_session.execute(delete(Plant).where(Plant.id == plant.id))
    await model_session.commit()
    for model in (
        Machine,
        PlantMember,
        MachineEvent,
        ProductionMinute,
        ProductionSample,
        AlertRule,
        Watchlist,
    ):
        assert await model_session.scalar(select(func.count()).select_from(model)) == 0
    assert await model_session.scalar(select(func.count()).select_from(User)) == 1


async def test_email_uniqueness_is_case_insensitive(model_session):
    await create_entities(model_session)
    await model_session.commit()
    model_session.add(
        User(
            username="second",
            email="DEMO@example.com",
            full_name="Second User",
            password_hash="hash",
        )
    )
    with pytest.raises(IntegrityError):
        await model_session.flush()


async def test_naive_timestamp_is_rejected(model_session):
    _, _, machine = await create_entities(model_session)
    model_session.add(
        MachineEvent(machine_id=machine.id, state="IDLE", started_at=datetime(2026, 1, 1))
    )
    with pytest.raises(StatementError, match="Timestamp must include a timezone"):
        await model_session.flush()


async def test_fractional_seconds_and_uint32_counts_roundtrip(model_session):
    _, _, machine = await create_entities(model_session)
    minute = ProductionMinute(
        machine_id=machine.id,
        bucket_start=datetime(2026, 10, 21, 12, tzinfo=UTC),
        good=4294967295,
        reject=1,
        run_s=12.125,
        down_s=47.875,
    )
    model_session.add(minute)
    await model_session.commit()
    model_session.expunge_all()
    stored = await model_session.scalar(select(ProductionMinute))
    assert stored.good == 4294967295
    assert stored.run_s == 12.125
    assert stored.down_s == 47.875


async def test_notification_deduplication_is_per_recipient(model_session):
    user, _, _ = await create_entities(model_session)
    model_session.add(
        Notification(user_id=user.id, type="MACHINE_DOWN", payload={}, dedupe_key="rule:1:event:2")
    )
    await model_session.commit()
    model_session.add(
        Notification(user_id=user.id, type="MACHINE_DOWN", payload={}, dedupe_key="rule:1:event:2")
    )
    with pytest.raises(IntegrityError):
        await model_session.flush()


async def test_database_default_keeps_plants_private(model_session):
    await model_session.execute(
        text("INSERT INTO plants(slug, name, timezone) VALUES ('new', 'New plant', 'UTC')")
    )
    await model_session.commit()
    plant = await model_session.scalar(select(Plant))
    assert plant.is_public is False
