from datetime import UTC, datetime, time, timedelta
from types import SimpleNamespace as Obj

import pytest

from app.services.oee import bucket_intervals, ratios, shift_intervals, window_totals


def dt(value):
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


def test_partial_shift_excludes_production_outside_planned_time():
    start, end = dt("2026-10-20T07:30:00"), dt("2026-10-20T09:00:00")
    plant = Obj(timezone="UTC")
    machine = Obj(ideal_cycle_s=30)
    shift = Obj(start_time=time(8), end_time=time(16), days_of_week=[2])
    event = Obj(state="RUNNING", started_at=start, ended_at=end)
    samples = [
        Obj(sampled_at=dt("2026-10-20T07:45:00"), good=100, reject=50),
        Obj(sampled_at=dt("2026-10-20T08:30:00"), good=100, reject=20),
    ]
    result = window_totals(machine, plant, [shift], [], samples, [event], start, end)
    assert result == {
        "availability": 1.0,
        "performance": 1.0,
        "quality": 100 / 120,
        "oee": 100 / 120,
        "good": 100,
        "reject": 20,
        "run_s": 3600.0,
        "planned_s": 3600.0,
    }


def test_shift_crossing_midnight_belongs_to_start_weekday():
    shift = Obj(start_time=time(22), end_time=time(6), days_of_week=[2])
    start, end = dt("2026-10-20T23:00:00"), dt("2026-10-21T07:00:00")
    assert shift_intervals([shift], "UTC", start, end) == [(start, dt("2026-10-21T06:00:00"))]


def test_zero_denominators_and_performance_cap():
    values = ratios(28, 0, 0, 0, 0)
    assert all(values[key] is None for key in ("availability", "performance", "quality", "oee"))
    planned = ratios(28, 0, 0, 0, 60)
    assert planned["availability"] == 0
    assert planned["oee"] is None
    assert ratios(28, 20, 1, 60, 120)["performance"] == 1


def test_partial_minute_counts_only_samples_inside_half_open_window():
    left = dt("2026-10-20T10:00:00")
    start, end = left + timedelta(seconds=15), left + timedelta(seconds=45)
    minute = Obj(bucket_start=left, good=3, reject=0)
    samples = [
        Obj(sampled_at=left + timedelta(seconds=second), good=1, reject=0) for second in (5, 20, 45)
    ]
    event = Obj(state="RUNNING", started_at=left, ended_at=None)
    result = window_totals(
        Obj(ideal_cycle_s=10), Obj(timezone="UTC"), [], [minute], samples, [event], start, end
    )
    assert result["good"] == 1
    assert result["run_s"] == 30
    assert result["planned_s"] == 30
    assert result["oee"] == pytest.approx(1 / 3)


def test_full_minute_does_not_count_samples_twice():
    start = dt("2026-10-20T10:00:00")
    end = start + timedelta(minutes=1)
    minute = Obj(bucket_start=start, good=3, reject=1)
    sample = Obj(sampled_at=start + timedelta(seconds=20), good=3, reject=1)
    event = Obj(state="RUNNING", started_at=start, ended_at=None)
    result = window_totals(
        Obj(ideal_cycle_s=10), Obj(timezone="UTC"), [], [minute], [sample], [event], start, end
    )
    assert result["good"] == 3 and result["reject"] == 1


def test_touching_shifts_remain_separate_buckets_but_planning_is_union():
    shifts = [
        Obj(start_time=time(0), end_time=time(8), days_of_week=[2]),
        Obj(start_time=time(8), end_time=time(16), days_of_week=[2]),
    ]
    start, end = dt("2026-10-20T00:00:00"), dt("2026-10-20T16:00:00")
    assert len(bucket_intervals(start, end, "shift", Obj(timezone="UTC"), shifts)) == 2
    assert shift_intervals(shifts, "UTC", start, end) == [(start, end)]


def test_day_buckets_follow_daylight_saving_transition():
    start, end = dt("2026-03-08T05:00:00"), dt("2026-03-09T04:00:00")
    buckets = bucket_intervals(start, end, "day", Obj(timezone="America/New_York"), [])
    assert len(buckets) == 1
    assert (buckets[0][1] - buckets[0][0]).total_seconds() == 23 * 3600


def test_cavities_convert_shot_time_to_piece_time_without_multiplying_counts():
    start = dt("2026-10-20T10:00:00")
    end = start + timedelta(minutes=1)
    run = Obj(started_at=start, ended_at=None, ideal_cycle_s=20, active_cavities=4)
    minute = Obj(bucket_start=start, good=8, reject=2)
    event = Obj(state="RUNNING", started_at=start, ended_at=None)
    result = window_totals(
        Obj(ideal_cycle_s=20),
        Obj(timezone="UTC"),
        [],
        [minute],
        [],
        [event],
        start,
        end,
        runs=[run],
        include_ideal_seconds=True,
    )
    assert (result["good"], result["reject"]) == (8, 2)
    assert result["ideal_seconds"] == 50
    assert result["performance"] == pytest.approx(50 / 60)
    assert result["quality"] == 0.8
    assert result["oee"] == pytest.approx(2 / 3)


def test_mid_minute_run_change_uses_sample_time_and_half_open_runs():
    start = dt("2026-10-20T10:00:00")
    boundary = start + timedelta(seconds=30)
    end = start + timedelta(minutes=1)
    runs = [
        Obj(started_at=start, ended_at=boundary, ideal_cycle_s=20, active_cavities=4),
        Obj(started_at=boundary, ended_at=None, ideal_cycle_s=12, active_cavities=2),
    ]
    samples = [
        Obj(sampled_at=start + timedelta(seconds=20), good=4, reject=0),
        Obj(sampled_at=boundary, good=2, reject=1),
    ]
    minute = Obj(bucket_start=start, good=6, reject=1)
    event = Obj(state="RUNNING", started_at=start, ended_at=end)
    result = window_totals(
        Obj(ideal_cycle_s=99),
        Obj(timezone="UTC"),
        [],
        [minute],
        samples,
        [event],
        start,
        end,
        runs=runs,
        include_ideal_seconds=True,
    )
    assert result["good"] == 6
    assert result["ideal_seconds"] == 4 * 5 + 3 * 6
    assert result["performance"] == pytest.approx(38 / 60)


def test_missing_sample_breakdown_never_fabricates_allocation_at_run_change():
    start = dt("2026-10-20T10:00:00")
    end = start + timedelta(minutes=1)
    run = Obj(
        started_at=start + timedelta(seconds=30), ended_at=None, ideal_cycle_s=20, active_cavities=4
    )
    result = window_totals(
        Obj(ideal_cycle_s=20),
        Obj(timezone="UTC"),
        [],
        [Obj(bucket_start=start, good=6, reject=0)],
        [],
        [Obj(state="RUNNING", started_at=start, ended_at=end)],
        start,
        end,
        runs=[run],
        include_ideal_seconds=True,
    )
    assert result["good"] == 6 and result["availability"] == 1
    assert result["ideal_seconds"] is None
    assert result["performance"] is None and result["oee"] is None


def test_line_stops_union_with_machine_stop_and_keep_planning_and_counts():
    start = dt("2026-10-20T10:00:00")
    end = start + timedelta(minutes=1)
    events = [
        Obj(state="RUNNING", started_at=start, ended_at=start + timedelta(seconds=20)),
        Obj(
            state="DOWN",
            started_at=start + timedelta(seconds=20),
            ended_at=start + timedelta(seconds=40),
        ),
        Obj(state="RUNNING", started_at=start + timedelta(seconds=40), ended_at=end),
    ]
    stops = [
        Obj(
            started_at=start + timedelta(seconds=10),
            ended_at=start + timedelta(seconds=35),
            planned=True,
        ),
        Obj(
            started_at=start + timedelta(seconds=30),
            ended_at=start + timedelta(seconds=50),
            planned=False,
        ),
    ]
    result = window_totals(
        Obj(ideal_cycle_s=5),
        Obj(timezone="UTC"),
        [],
        [Obj(bucket_start=start, good=2, reject=0)],
        [],
        events,
        start,
        end,
        downtimes=stops,
    )
    assert result["planned_s"] == 60
    assert result["run_s"] == 20  # [00,10) and [50,60), not two deductions of overlap
    assert result["good"] == 2
    assert result["availability"] == pytest.approx(1 / 3)
    assert result["performance"] == 0.5


def test_open_line_stop_only_affects_running_time_inside_shift():
    start = dt("2026-10-20T07:00:00")
    end = dt("2026-10-20T10:00:00")
    shift = Obj(start_time=time(8), end_time=time(16), days_of_week=[2])
    event = Obj(state="RUNNING", started_at=start, ended_at=end)
    stop = Obj(started_at=dt("2026-10-20T09:00:00"), ended_at=None)
    result = window_totals(
        Obj(ideal_cycle_s=5),
        Obj(timezone="UTC"),
        [shift],
        [],
        [],
        [event],
        start,
        end,
        downtimes=[stop],
    )
    assert result["planned_s"] == 7200
    assert result["run_s"] == 3600


async def test_database_loads_frozen_line_membership_and_weighted_plant_summary(db_session):
    from app.models import (
        DowntimeReason,
        LineDowntime,
        LineDowntimeMachine,
        Machine,
        MachineEvent,
        Mold,
        Plant,
        ProductionLine,
        ProductionMinute,
        ProductionRun,
    )
    from app.services.oee import machine_totals, plant_summary

    start = dt("2026-10-19T10:00:00")
    end = start + timedelta(minutes=1)
    plant = Plant(name="Injection", slug="injection", timezone="UTC")
    db_session.add(plant)
    await db_session.flush()
    line = ProductionLine(plant_id=plant.id, code="L1", name="Original")
    mold = Mold(plant_id=plant.id, code="M1", name="Mold", nominal_cavities=4)
    reason = DowntimeReason(
        code="MATERIAL", label_es="Material", label_en="Material", category="material"
    )
    db_session.add_all([line, mold, reason])
    await db_session.flush()
    machine = Machine(
        plant_id=plant.id,
        name="Injection",
        slug="injection",
        host="localhost",
        ideal_cycle_s=20,
        line_id=None,
    )  # Moved since the historical stop
    db_session.add(machine)
    await db_session.flush()
    run = ProductionRun(
        plant_id=plant.id,
        machine_id=machine.id,
        mold_id=mold.id,
        order_id=None,
        context={},
        nominal_cavities=4,
        active_cavities=4,
        ideal_cycle_s=20,
        part_weight_g=12,
        started_at=start,
        ended_at=end,
    )
    # No order is needed to test OEE, but production runs require its catalog lineage.
    from app.models import InjectionRecipe, Product, ProductionOrder, Resin

    product = Product(plant_id=plant.id, code="P1", name="Cap", part_weight_g=12)
    resin = Resin(plant_id=plant.id, code="R1", name="PP", polymer="PP", grade="G")
    db_session.add_all([product, resin])
    await db_session.flush()
    recipe = InjectionRecipe(
        plant_id=plant.id,
        code="C1",
        name="Cap",
        product_id=product.id,
        mold_id=mold.id,
        resin_id=resin.id,
        ideal_cycle_s=20,
        active_cavities=4,
    )
    db_session.add(recipe)
    await db_session.flush()
    order = ProductionOrder(plant_id=plant.id, code="O1", recipe_id=recipe.id, target_pieces=100)
    db_session.add(order)
    await db_session.flush()
    run.order_id = order.id
    stop = LineDowntime(
        plant_id=plant.id,
        line_id=line.id,
        reason_code=reason.code,
        started_at=start + timedelta(seconds=30),
        ended_at=end,
    )
    db_session.add_all(
        [
            run,
            stop,
            MachineEvent(machine_id=machine.id, state="RUNNING", started_at=start, ended_at=end),
            ProductionMinute(machine_id=machine.id, bucket_start=start, good=4, reject=0),
        ]
    )
    await db_session.flush()
    db_session.add(LineDowntimeMachine(downtime_id=stop.id, machine_id=machine.id))
    await db_session.commit()
    result = await machine_totals(db_session, machine, start, end)
    assert result["run_s"] == 30 and result["planned_s"] == 60
    assert result["performance"] == pytest.approx(20 / 30)
    summary = await plant_summary(db_session, plant, date=start.date())
    assert summary["plant"]["performance"] == pytest.approx(20 / 30)
    assert "ideal_seconds" not in summary["machines"][0]
