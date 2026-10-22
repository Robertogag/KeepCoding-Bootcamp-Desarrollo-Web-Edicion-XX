"""Batch telemetry persistence, compatible with PostgreSQL and SQLite test databases."""

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.collector.state import MachineRuntime
from app.models import (
    Machine,
    MachineCheckpoint,
    MachineEvent,
    MachineTelemetry,
    ProductionMinute,
    ProductionRun,
    ProductionSample,
)


async def persist_runtimes(session: AsyncSession, runtimes: list[MachineRuntime]) -> set[int]:
    if not runtimes:
        return set()
    existing = set(
        (
            await session.scalars(
                select(Machine.id).where(
                    Machine.id.in_([runtime.machine_id for runtime in runtimes]),
                )
            )
        ).all()
    )
    insert = sqlite_insert if session.bind.dialect.name == "sqlite" else pg_insert
    minutes = []
    samples = []
    checkpoints = []
    telemetry = []
    for runtime in runtimes:
        if runtime.machine_id not in existing:
            continue
        for transition in runtime.transitions:
            await session.execute(
                update(MachineEvent)
                .where(
                    MachineEvent.machine_id == runtime.machine_id,
                    MachineEvent.ended_at.is_(None),
                )
                .values(ended_at=transition.started_at)
            )
            session.add(
                MachineEvent(
                    machine_id=runtime.machine_id,
                    state=transition.state,
                    started_at=transition.started_at,
                    reason_code=transition.reason_code,
                )
            )
            await session.flush()
        minutes.extend(runtime.minute_rows())
        samples.extend(runtime.samples)
        telemetry.extend(dict(row) for row in runtime.telemetry)
        if runtime.accounted_at is not None:
            checkpoints.append(
                {
                    "machine_id": runtime.machine_id,
                    "accounted_at": runtime.accounted_at,
                    "snapshot": runtime.snapshot_base(),
                    "progress": runtime.checkpoint(),
                }
            )
    if telemetry:
        first = min(row["sampled_at"] for row in telemetry)
        last = max(row["sampled_at"] for row in telemetry)
        runs = list(
            await session.scalars(
                select(ProductionRun).where(
                    ProductionRun.machine_id.in_(existing),
                    ProductionRun.started_at <= last,
                    or_(ProductionRun.ended_at.is_(None), ProductionRun.ended_at > first),
                )
            )
        )
        for row in telemetry:
            matches = [
                run
                for run in runs
                if run.machine_id == row["machine_id"]
                and run.started_at <= row["sampled_at"]
                and (run.ended_at is None or row["sampled_at"] < run.ended_at)
            ]
            row["run_id"] = matches[0].id if len(matches) == 1 else None
        for offset in range(0, len(telemetry), 500):
            statement = insert(MachineTelemetry).values(telemetry[offset : offset + 500])
            await session.execute(
                statement.on_conflict_do_nothing(
                    index_elements=[MachineTelemetry.machine_id, MachineTelemetry.sampled_at]
                )
            )
    # Keep statement parameter counts bounded during recovery after a DB outage.
    for offset in range(0, len(minutes), 500):
        statement = insert(ProductionMinute).values(minutes[offset : offset + 500])
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[ProductionMinute.machine_id, ProductionMinute.bucket_start],
                set_={
                    column: getattr(ProductionMinute, column) + getattr(statement.excluded, column)
                    for column in ("good", "reject", "run_s", "idle_s", "down_s", "offline_s")
                },
            )
        )
    for offset in range(0, len(samples), 500):
        statement = insert(ProductionSample).values(samples[offset : offset + 500])
        await session.execute(
            statement.on_conflict_do_nothing(
                index_elements=[ProductionSample.machine_id, ProductionSample.sampled_at],
            )
        )
    for offset in range(0, len(checkpoints), 500):
        statement = insert(MachineCheckpoint).values(checkpoints[offset : offset + 500])
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[MachineCheckpoint.machine_id],
                set_={
                    column: getattr(statement.excluded, column)
                    for column in ("accounted_at", "snapshot", "progress")
                },
            )
        )
    return existing
