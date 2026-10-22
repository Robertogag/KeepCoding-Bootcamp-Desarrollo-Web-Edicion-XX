from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select

from app.models import (
    DowntimeReason,
    LineDowntime,
    LineDowntimeMachine,
    Machine,
    MachineBoardPosition,
    MachineCheckpoint,
    MachineEvent,
    ProductionLine,
    ProductionMinute,
    ProductionOrder,
    ProductionRun,
    ProductionSample,
    Shift,
)
from app.services.oee import (
    METRICS,
    EventWindow,
    aware,
    day_window,
    iso,
    observed_snapshot,
    ratios,
    sample_windows,
    shift_intervals,
    window_totals,
)


def grouped(rows, field):
    result = defaultdict(list)
    for row in rows:
        result[getattr(row, field)].append(row)
    return result


def run_data(run, order):
    if run is None:
        return None
    context = run.context
    return dict(
        id=run.id,
        order_id=run.order_id,
        order_code=order.code,
        product_id=context["product_id"],
        product_code=context["product_code"],
        product_name=context["product_name"],
        mold_id=run.mold_id,
        mold_code=context["mold_code"],
        mold_name=context.get("mold_name"),
        nominal_cavities=run.nominal_cavities,
        active_cavities=run.active_cavities,
        ideal_cycle_s=float(run.ideal_cycle_s),
        ideal_seconds_per_piece=float(run.ideal_cycle_s) / run.active_cavities,
        started_at=iso(run.started_at),
    )


def stop_data(
    *,
    kind,
    identifier,
    line_id,
    machine_id,
    affected,
    started_at,
    now,
    reason_code=None,
    reason=None,
    planned=None,
    comment=None,
):
    return dict(
        kind=kind,
        id=identifier,
        line_id=line_id,
        machine_id=machine_id,
        affected_machine_ids=sorted(affected),
        started_at=iso(started_at),
        elapsed_s=max(0.0, (now - aware(started_at)).total_seconds()) if started_at else None,
        reason_code=reason_code,
        label_es=reason.label_es if reason else None,
        label_en=reason.label_en if reason else None,
        planned=planned,
        comment=comment,
    )


async def plant_board(session, plant, *, now=None):
    now = aware(now or datetime.now(UTC))
    start, end = day_window(plant, now=now)
    machines = list(
        await session.scalars(
            select(Machine).where(Machine.plant_id == plant.id).order_by(Machine.name, Machine.id)
        )
    )
    machine_ids = [machine.id for machine in machines]
    lines = list(
        await session.scalars(
            select(ProductionLine)
            .where(ProductionLine.plant_id == plant.id)
            .order_by(ProductionLine.code, ProductionLine.id)
        )
    )
    shifts = list(await session.scalars(select(Shift).where(Shift.plant_id == plant.id)))
    positions = {
        row.machine_id: row
        for row in await session.scalars(
            select(MachineBoardPosition).where(MachineBoardPosition.machine_id.in_(machine_ids))
        )
    }
    checkpoints = {
        row.machine_id: row
        for row in await session.scalars(
            select(MachineCheckpoint).where(MachineCheckpoint.machine_id.in_(machine_ids))
        )
    }
    runs = list(
        await session.scalars(
            select(ProductionRun)
            .where(
                ProductionRun.plant_id == plant.id,
                ProductionRun.started_at <= now,
                or_(ProductionRun.ended_at.is_(None), ProductionRun.ended_at > start),
            )
            .order_by(ProductionRun.started_at, ProductionRun.id)
        )
    )
    current = {row.machine_id: row for row in runs if row.ended_at is None}
    orders = {
        row.id: row
        for row in await session.scalars(
            select(ProductionOrder).where(
                ProductionOrder.id.in_({run.order_id for run in current.values()})
            )
        )
    }
    minutes = grouped(
        await session.scalars(
            select(ProductionMinute).where(
                ProductionMinute.machine_id.in_(machine_ids),
                ProductionMinute.bucket_start >= start.replace(second=0, microsecond=0),
                ProductionMinute.bucket_start < end,
            )
        ),
        "machine_id",
    )
    runs_by_machine = grouped(runs, "machine_id")
    sample_ranges = [
        and_(
            ProductionSample.machine_id == machine.id,
            ProductionSample.sampled_at >= left,
            ProductionSample.sampled_at < right,
        )
        for machine in machines
        for left, right in sample_windows(
            machine, plant, shifts, minutes[machine.id], runs_by_machine[machine.id], start, end
        )
    ]
    samples = grouped(
        await session.scalars(select(ProductionSample).where(or_(*sample_ranges)))
        if sample_ranges
        else [],
        "machine_id",
    )
    events = grouped(
        await session.scalars(
            select(MachineEvent)
            .where(
                MachineEvent.machine_id.in_(machine_ids),
                MachineEvent.started_at <= now,
                or_(MachineEvent.ended_at.is_(None), MachineEvent.ended_at > start),
            )
            .order_by(MachineEvent.started_at, MachineEvent.id)
        ),
        "machine_id",
    )
    downtimes = list(
        await session.scalars(
            select(LineDowntime)
            .where(
                LineDowntime.plant_id == plant.id,
                LineDowntime.started_at <= now,
                or_(LineDowntime.ended_at.is_(None), LineDowntime.ended_at > start),
            )
            .order_by(LineDowntime.started_at, LineDowntime.id)
        )
    )
    affected = grouped(
        await session.scalars(
            select(LineDowntimeMachine).where(
                LineDowntimeMachine.downtime_id.in_([row.id for row in downtimes]),
            )
        ),
        "downtime_id",
    )
    reasons = {row.code: row for row in await session.scalars(select(DowntimeReason))}
    stops_by_machine = defaultdict(list)
    stops = []
    for row in downtimes:
        ids = [link.machine_id for link in affected[row.id]]
        for machine_id in ids:
            stops_by_machine[machine_id].append(row)
        if row.ended_at is None:
            stops.append(
                stop_data(
                    kind="line",
                    identifier=row.id,
                    line_id=row.line_id,
                    machine_id=None,
                    affected=ids,
                    started_at=row.started_at,
                    now=now,
                    reason_code=row.reason_code,
                    reason=reasons.get(row.reason_code),
                    planned=row.planned,
                    comment=row.comment,
                )
            )

    states = dict.fromkeys(("RUNNING", "IDLE", "DOWN", "OFFLINE"), 0)
    totals = dict.fromkeys(("good", "reject", "run_s", "planned_s"), 0)
    ideal_seconds, exact_standard = 0.0, True
    machine_rows = []
    for machine in machines:
        checkpoint = checkpoints.get(machine.id)
        machine_events = events[machine.id]
        windows = (
            [
                EventWindow(
                    event.state, event.started_at, event.ended_at or checkpoint.accounted_at
                )
                for event in machine_events
            ]
            if checkpoint
            else machine_events
        )
        values = window_totals(
            machine,
            plant,
            shifts,
            minutes[machine.id],
            samples[machine.id],
            windows,
            start,
            end,
            runs=runs_by_machine[machine.id],
            downtimes=stops_by_machine[machine.id],
            include_ideal_seconds=True,
        )
        for key in totals:
            totals[key] += values[key]
        if values["ideal_seconds"] is None:
            exact_standard = False
        else:
            ideal_seconds += values["ideal_seconds"]
        snapshot = await observed_snapshot(session, machine)
        snapshot["oee_today"] = (
            {key: values[key] for key in METRICS} if snapshot["since"] else dict.fromkeys(METRICS)
        )
        states[snapshot["state"]] += 1
        position = positions.get(machine.id)
        run = current.get(machine.id)
        machine_rows.append(
            dict(
                **{
                    key: getattr(machine, key)
                    for key in (
                        "id",
                        "name",
                        "slug",
                        "brand",
                        "model",
                        "is_active",
                        "line_id",
                    )
                },
                position={
                    key: getattr(position, key)
                    for key in (
                        "x",
                        "y",
                        "width",
                        "height",
                        "rotation",
                        "updated_at",
                    )
                }
                if position
                else None,
                snapshot=snapshot,
                observed_at=iso(checkpoint.accounted_at) if checkpoint else None,
                current_run=run_data(run, orders.get(run.order_id) if run else None),
            )
        )
        if snapshot["state"] == "DOWN":
            since = datetime.fromisoformat(snapshot["since"]) if snapshot["since"] else None
            event = next(
                (
                    row
                    for row in reversed(machine_events)
                    if row.state == "DOWN"
                    and row.ended_at is None
                    and since is not None
                    and aware(row.started_at) == aware(since)
                ),
                None,
            )
            reason_code = event.reason_code if event else None
            stops.append(
                stop_data(
                    kind="machine",
                    identifier=event.id if event else None,
                    line_id=machine.line_id,
                    machine_id=machine.id,
                    affected=[machine.id],
                    started_at=event.started_at if event else since,
                    now=now,
                    reason_code=reason_code,
                    reason=reasons.get(reason_code),
                    comment=event.comment if event else None,
                )
            )
    pieces = totals["good"] + totals["reject"]
    aggregate = ratios(ideal_seconds / pieces if pieces else 0, **totals)
    if not exact_standard:
        aggregate.update(performance=None, oee=None)
    return dict(
        generated_at=iso(now),
        plant={key: getattr(plant, key) for key in ("id", "slug", "name", "timezone")},
        scheduled_now=bool(
            shift_intervals(shifts, plant.timezone, now, now + timedelta(microseconds=1))
        ),
        summary=dict(
            machine_count=len(machines),
            active_machine_count=sum(machine.is_active for machine in machines),
            states=states,
            active_runs=len(current),
            without_active_run=sum(
                machine.is_active and machine.id not in current for machine in machines
            ),
            line_stops=sum(stop["kind"] == "line" for stop in stops),
            oee_today={key: aggregate[key] for key in METRICS},
        ),
        lines=[
            {key: getattr(line, key) for key in ("id", "code", "name", "is_active")}
            for line in lines
        ],
        machines=machine_rows,
        stops=stops,
    )
