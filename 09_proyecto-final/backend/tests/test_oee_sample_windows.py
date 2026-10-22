from datetime import UTC, datetime, time, timedelta
from types import SimpleNamespace as Obj

import pytest

from app.models import Machine, MachineEvent, Plant, ProductionMinute, ProductionSample
from app.services.oee import load_window, sample_windows, window_totals

START = datetime(2026, 10, 20, 10, tzinfo=UTC)
PLANT = Obj(timezone="UTC")
MACHINE = Obj(ideal_cycle_s=20)


def shift(start, end, weekday=2):
    return Obj(start_time=start, end_time=end, days_of_week=[weekday])


@pytest.mark.parametrize(
    "shifts",
    [
        [],
        [shift(time(10, 0, 25), time(10, 4, 20))],
        [shift(time(10), time(11), weekday=3)],
        [shift(time(10), time(10, 2, 15)), shift(time(10, 2, 45), time(11))],
    ],
)
def test_reduced_samples_preserve_partial_shifts_missing_minutes_and_standard_changes(shifts):
    start, end = START + timedelta(seconds=15), START + timedelta(minutes=4, seconds=30)
    minutes = [
        Obj(bucket_start=START + timedelta(minutes=index), good=2, reject=1)
        for index in (0, 1, 2, 4)
    ]
    samples = [
        Obj(
            sampled_at=START + timedelta(minutes=index, seconds=second),
            good=int(second != 20),
            reject=int(second == 20),
        )
        for index in range(5)
        for second in (5, 20, 45)
    ]
    runs = [
        Obj(
            started_at=START + timedelta(minutes=2, seconds=30),
            ended_at=None,
            ideal_cycle_s=12,
            active_cavities=2,
        )
    ]
    windows = sample_windows(MACHINE, PLANT, shifts, minutes, runs, start, end)
    selected = [
        row for row in samples if any(left <= row.sampled_at < right for left, right in windows)
    ]
    event = Obj(state="RUNNING", started_at=START, ended_at=end)
    expected = window_totals(
        MACHINE,
        PLANT,
        shifts,
        minutes,
        samples,
        [event],
        start,
        end,
        runs=runs,
        include_ideal_seconds=True,
    )
    actual = window_totals(
        MACHINE,
        PLANT,
        shifts,
        minutes,
        selected,
        [event],
        start,
        end,
        runs=runs,
        include_ideal_seconds=True,
    )
    assert actual == expected
    assert len(selected) < len(samples)
    assert all(start <= left < right <= end for left, right in windows)


@pytest.mark.parametrize("same_standard,zero_output", [(True, False), (False, True)])
def test_full_minute_needs_no_detail_when_standard_matches_or_output_is_zero(
    same_standard, zero_output
):
    end = START + timedelta(minutes=1)
    run = Obj(
        started_at=START + timedelta(seconds=30),
        ended_at=None,
        ideal_cycle_s=40 if same_standard else 12,
        active_cavities=2,
    )
    minute = Obj(bucket_start=START, good=0 if zero_output else 2, reject=0)
    assert sample_windows(MACHINE, PLANT, [], [minute], [run], START, end) == []


def test_missing_detail_for_mixed_minute_still_propagates_unknown_performance():
    end = START + timedelta(minutes=1)
    minute = Obj(bucket_start=START, good=4, reject=0)
    run = Obj(
        started_at=START + timedelta(seconds=30),
        ended_at=None,
        ideal_cycle_s=20,
        active_cavities=4,
    )
    assert sample_windows(MACHINE, PLANT, [], [minute], [run], START, end) == [(START, end)]
    result = window_totals(
        MACHINE,
        PLANT,
        [],
        [minute],
        [],
        [Obj(state="RUNNING", started_at=START, ended_at=end)],
        START,
        end,
        runs=[run],
        include_ideal_seconds=True,
    )
    assert result["good"] == 4
    assert result["performance"] is result["oee"] is result["ideal_seconds"] is None


def test_sample_windows_preserve_timezone_and_half_open_boundaries():
    start = datetime.fromisoformat("2026-10-20T04:00:15-06:00")
    end = datetime.fromisoformat("2026-10-20T04:00:45-06:00")
    minute = Obj(bucket_start=START, good=3, reject=0)
    assert sample_windows(MACHINE, PLANT, [], [minute], [], start, end) == [
        (START + timedelta(seconds=15), START + timedelta(seconds=45))
    ]


async def test_load_window_fetches_only_needed_sample_rows_from_database(db_session):
    plant = Plant(name="Optimized", slug="optimized", timezone="UTC")
    db_session.add(plant)
    await db_session.flush()
    machine = Machine(plant_id=plant.id, name="M", slug="m", host="localhost", ideal_cycle_s=20)
    db_session.add(machine)
    await db_session.flush()
    end = START + timedelta(minutes=3, seconds=30)
    # Minutes 0/1 have complete aggregates; minute 2 has samples but no aggregate.
    for index in (0, 1, 3):
        db_session.add(
            ProductionMinute(
                machine_id=machine.id,
                bucket_start=START + timedelta(minutes=index),
                good=3,
                reject=0,
            )
        )
    for index in range(4):
        for second in (5, 20, 45):
            db_session.add(
                ProductionSample(
                    machine_id=machine.id,
                    sampled_at=START + timedelta(minutes=index, seconds=second),
                    good=1,
                    reject=0,
                )
            )
    db_session.add(
        MachineEvent(machine_id=machine.id, state="RUNNING", started_at=START, ended_at=end)
    )
    await db_session.commit()
    values = await load_window(db_session, machine, START, end)
    loaded = values[3]
    assert [row.sampled_at for row in sorted(loaded, key=lambda row: row.sampled_at)] == [
        START + timedelta(minutes=minute, seconds=second)
        for minute, second in [(2, 5), (2, 20), (2, 45), (3, 5), (3, 20)]
    ]
    result = window_totals(machine, *values[:5], START, end, runs=values[5], downtimes=values[6])
    assert result["good"] == 11
    assert (await load_window(db_session, machine, START, START + timedelta(minutes=2)))[3] == []
