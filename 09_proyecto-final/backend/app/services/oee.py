import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import and_, or_, select

from app.config import settings
from app.errors import ApiError
from app.models import (
    LineDowntime,
    LineDowntimeMachine,
    Machine,
    MachineCheckpoint,
    MachineEvent,
    Plant,
    ProductionMinute,
    ProductionRun,
    ProductionSample,
    Shift,
)

METRICS = ("availability", "performance", "quality", "oee")


@dataclass(frozen=True)
class EventWindow:
    state: str
    started_at: datetime
    ended_at: datetime | None


def aware(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def iso(value):
    return aware(value).isoformat().replace("+00:00", "Z") if value else None


def ratios(ideal_cycle_s, good, reject, run_s, planned_s):
    total = good + reject
    availability = run_s / planned_s if planned_s else None
    performance = min(ideal_cycle_s * total / run_s, 1.0) if run_s else None
    quality = good / total if total else None
    oee = (
        availability * performance * quality
        if None not in (availability, performance, quality)
        else None
    )
    return dict(
        availability=availability,
        performance=performance,
        quality=quality,
        oee=oee,
        good=good,
        reject=reject,
        run_s=run_s,
        planned_s=planned_s,
    )


def union(intervals):
    merged = []
    for start, end in sorted(intervals):
        if end <= start:
            continue
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def subtract_intervals(intervals, excluded):
    """Subtract the union once, even when line and machine stops overlap."""
    result = []
    excluded = union(excluded)
    for left, right in union(intervals):
        cursor = left
        for stop, resume in excluded:
            if resume <= cursor or stop >= right:
                continue
            if stop > cursor:
                result.append((cursor, stop))
            cursor = max(cursor, min(resume, right))
        if cursor < right:
            result.append((cursor, right))
    return result


def shift_intervals(shifts, zone, start, end, merge=True):
    start, end = aware(start), aware(end)
    if not shifts:
        return [(start, end)] if end > start else []
    tz = ZoneInfo(zone)
    day = start.astimezone(tz).date() - timedelta(days=1)
    last_day = end.astimezone(tz).date()
    intervals = []
    while day <= last_day:
        for shift in shifts:
            if day.isoweekday() not in shift.days_of_week:
                continue
            finish_day = day + timedelta(days=shift.end_time <= shift.start_time)
            left = datetime.combine(day, shift.start_time, tzinfo=tz).astimezone(UTC)
            right = datetime.combine(finish_day, shift.end_time, tzinfo=tz).astimezone(UTC)
            if left < end and right > start:
                intervals.append((max(start, left), min(end, right)))
        day += timedelta(days=1)
    return union(intervals) if merge else sorted(intervals)


def overlap_seconds(start, end, intervals):
    return sum(
        max(0.0, (min(end, right) - max(start, left)).total_seconds()) for left, right in intervals
    )


def day_window(plant, day=None, now=None):
    now = now or datetime.now(UTC)
    tz = ZoneInfo(plant.timezone)
    day = day or now.astimezone(tz).date()
    start = datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC)
    return start, max(start, min(end, now))


def sample_windows(machine, plant, shifts, minutes, runs, start, end):
    """Keep detail only where minute aggregates cannot answer window_totals exactly.

    Full scheduled minutes with one effective seconds-per-piece standard need no
    cycle rows. Keep partial minutes, missing aggregates and mixed-standard minutes
    with production. Returned intervals are UTC and half-open, respecting shift gaps.
    """
    start, end = aware(start), aware(end)
    intervals = shift_intervals(shifts, plant.timezone, start, end)
    standards = [
        (
            aware(row.started_at),
            aware(row.ended_at) if row.ended_at else end,
            float(row.ideal_cycle_s) / row.active_cavities,
        )
        for row in runs
    ]

    def ideal_at(instant):
        for left, right, ideal in standards:
            if left <= instant < right:
                return ideal
        return float(machine.ideal_cycle_s)

    covered = []
    for minute in minutes:
        left = aware(minute.bucket_start)
        right = left + timedelta(minutes=1)
        if overlap_seconds(left, right, intervals) < 60:
            continue
        boundaries = {left}
        for begin, finish, _ in standards:
            boundaries.update(point for point in (begin, finish) if left < point < right)
        if minute.good + minute.reject == 0 or len({ideal_at(point) for point in boundaries}) == 1:
            covered.append((left, right))
    return subtract_intervals(intervals, covered)


async def load_window(session, machine, start, end):
    plant = await session.get(Plant, machine.plant_id)
    shifts = list(await session.scalars(select(Shift).where(Shift.plant_id == plant.id)))
    minutes = list(
        await session.scalars(
            select(ProductionMinute).where(
                ProductionMinute.machine_id == machine.id,
                ProductionMinute.bucket_start >= start.replace(second=0, microsecond=0),
                ProductionMinute.bucket_start < end,
            )
        )
    )
    events = list(
        await session.scalars(
            select(MachineEvent).where(
                MachineEvent.machine_id == machine.id,
                MachineEvent.started_at < end,
                or_(MachineEvent.ended_at.is_(None), MachineEvent.ended_at > start),
            )
        )
    )
    checkpoint = await session.get(MachineCheckpoint, machine.id)
    if checkpoint:
        events = [
            EventWindow(event.state, event.started_at, event.ended_at or checkpoint.accounted_at)
            for event in events
        ]
    runs = list(
        await session.scalars(
            select(ProductionRun)
            .where(
                ProductionRun.machine_id == machine.id,
                ProductionRun.started_at < end,
                or_(ProductionRun.ended_at.is_(None), ProductionRun.ended_at > start),
            )
            .order_by(ProductionRun.started_at)
        )
    )
    windows = sample_windows(machine, plant, shifts, minutes, runs, start, end)
    samples = (
        list(
            await session.scalars(
                select(ProductionSample).where(
                    ProductionSample.machine_id == machine.id,
                    or_(
                        *[
                            and_(
                                ProductionSample.sampled_at >= left,
                                ProductionSample.sampled_at < right,
                            )
                            for left, right in windows
                        ]
                    ),
                )
            )
        )
        if windows
        else []
    )
    downtimes = list(
        await session.scalars(
            select(LineDowntime)
            .join(LineDowntimeMachine, LineDowntimeMachine.downtime_id == LineDowntime.id)
            .where(
                LineDowntimeMachine.machine_id == machine.id,
                LineDowntime.started_at < end,
                or_(LineDowntime.ended_at.is_(None), LineDowntime.ended_at > start),
            )
        )
    )
    return plant, shifts, minutes, samples, events, runs, downtimes


def window_totals(
    machine,
    plant,
    shifts,
    minutes,
    samples,
    events,
    start,
    end,
    *,
    runs=(),
    downtimes=(),
    include_ideal_seconds=False,
):
    intervals = shift_intervals(shifts, plant.timezone, start, end)
    planned = sum((right - left).total_seconds() for left, right in intervals)
    run_intervals = union(
        (
            max(start, aware(event.started_at)),
            min(end, aware(event.ended_at) if event.ended_at else end),
        )
        for event in events
        if event.state == "RUNNING"
    )
    # A planned stop is a classification; it does not remove scheduled time.
    # Machine state stays observed; only availability accounts for manual line stops.
    stops = [
        (
            max(start, aware(stop.started_at)),
            min(end, aware(stop.ended_at) if stop.ended_at else end),
        )
        for stop in downtimes
    ]
    run_intervals = subtract_intervals(run_intervals, stops)
    run = sum(overlap_seconds(left, right, intervals) for left, right in run_intervals)
    standards = [
        (
            aware(row.started_at),
            aware(row.ended_at) if row.ended_at else end,
            float(row.ideal_cycle_s) / row.active_cavities,
        )
        for row in runs
    ]

    def ideal_at(instant):
        for left, right, ideal in standards:
            if left <= instant < right:
                return ideal
        return float(machine.ideal_cycle_s)

    samples_by_minute = {}
    for sample in samples:
        minute_key = aware(sample.sampled_at).replace(second=0, microsecond=0)
        samples_by_minute.setdefault(minute_key, []).append(sample)
    whole_minutes = set()
    good = reject = 0
    ideal_seconds = 0.0
    exact_standard = True
    for minute in minutes:
        left = aware(minute.bucket_start)
        right = left + timedelta(minutes=1)
        if overlap_seconds(left, right, intervals) >= 60:
            good += minute.good
            reject += minute.reject
            whole_minutes.add(left)
            boundaries = {left}
            for begin, finish, _ in standards:
                boundaries.update(point for point in (begin, finish) if left < point < right)
            rates = {ideal_at(point) for point in boundaries}
            if len(rates) == 1 or minute.good + minute.reject == 0:
                ideal_seconds += ideal_at(left) * (minute.good + minute.reject)
            else:
                detail = samples_by_minute.get(left, [])
                if (
                    sum(row.good for row in detail) == minute.good
                    and sum(row.reject for row in detail) == minute.reject
                ):
                    ideal_seconds += sum(
                        ideal_at(aware(row.sampled_at)) * (row.good + row.reject) for row in detail
                    )
                else:
                    # Preserve measured counts, but never fabricate allocation to a mold.
                    exact_standard = False
    for sample in samples:
        instant = aware(sample.sampled_at)
        if instant.replace(second=0, microsecond=0) not in whole_minutes and any(
            left <= instant < right for left, right in intervals
        ):
            good += sample.good
            reject += sample.reject
            ideal_seconds += ideal_at(instant) * (sample.good + sample.reject)
    total = good + reject
    result = ratios(ideal_seconds / total if total else 0, good, reject, min(run, planned), planned)
    if not exact_standard:
        result.update(performance=None, oee=None)
    if include_ideal_seconds:
        result["ideal_seconds"] = ideal_seconds if exact_standard else None
    return result


async def machine_totals(session, machine, start, end, *, include_ideal_seconds=False):
    start, end = aware(start), aware(end)
    if end <= start:
        result = ratios(float(machine.ideal_cycle_s), 0, 0, 0, 0)
        if include_ideal_seconds:
            result["ideal_seconds"] = 0.0
        return result
    values = await load_window(session, machine, start, end)
    return window_totals(
        machine,
        *values[:5],
        start,
        end,
        runs=values[5],
        downtimes=values[6],
        include_ideal_seconds=include_ideal_seconds,
    )


async def oee_today(session, machine):
    plant = await session.get(Plant, machine.plant_id)
    values = await machine_totals(session, machine, *day_window(plant))
    return {key: values[key] for key in METRICS}


async def observed_snapshot(session, machine):
    raw = checkpoint_raw = heartbeat = None
    cache_available = True
    try:
        async with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        ) as cache:
            # Conserva valores leídos aunque Redis falle durante las siguientes lecturas.
            raw = await cache.get(f"machine:{machine.id}:snapshot")
            checkpoint_raw = await cache.get(f"machine:{machine.id}:collector")
            heartbeat = await cache.get("collector:heartbeat")
    except RedisError:
        cache_available = False

    def cached_object(value):
        try:
            if isinstance(value, dict):
                return value
            decoded = json.loads(value) if value else None
            return decoded if isinstance(decoded, dict) else None
        except (ValueError, TypeError):
            return None

    def timestamp(value):
        try:
            parsed = datetime.fromisoformat(value)
            return iso(parsed) if parsed.tzinfo is not None else None
        except (ValueError, TypeError):
            return None

    checkpoint = cached_object(checkpoint_raw)
    snapshot = None
    fields = ("state", "since", "good", "reject", "alarm_code", "last_cycle_s")
    for candidate in (cached_object(raw), checkpoint):
        if (
            candidate
            and all(key in candidate for key in fields)
            and candidate["state"] in {"RUNNING", "IDLE", "DOWN", "OFFLINE"}
        ):
            snapshot = {key: candidate[key] for key in fields}

    offline = not cache_available or not heartbeat
    accounted_at = timestamp(checkpoint.get("accounted_at")) if checkpoint else None
    if offline or snapshot is None:
        durable = await session.get(MachineCheckpoint, machine.id)
        if durable:
            candidate = cached_object(durable.snapshot)
            durable_time = iso(durable.accounted_at)
            if (
                candidate
                and all(key in candidate for key in fields)
                and candidate["state"] in {"RUNNING", "IDLE", "DOWN", "OFFLINE"}
                and (
                    not accounted_at
                    or datetime.fromisoformat(durable_time) >= datetime.fromisoformat(accounted_at)
                )
            ):
                snapshot = {key: candidate[key] for key in fields}
                accounted_at = durable_time
    if snapshot is None or (offline and not accounted_at):
        event = await session.scalar(
            select(MachineEvent)
            .where(MachineEvent.machine_id == machine.id)
            .order_by(MachineEvent.started_at.desc())
            .limit(1)
        )
    else:
        event = None
    if snapshot is None:
        snapshot = dict(
            state="OFFLINE",
            since=iso(event.ended_at or event.started_at) if event else None,
            good=0,
            reject=0,
            alarm_code=0,
            last_cycle_s=None,
        )
    elif offline and snapshot["state"] != "OFFLINE":
        snapshot["state"] = "OFFLINE"
        snapshot["since"] = (
            accounted_at
            or (iso(event.ended_at or event.started_at) if event else None)
            or timestamp(snapshot["since"])
        )
    return snapshot


async def machine_snapshot(session, machine):
    snapshot = await observed_snapshot(session, machine)
    snapshot["oee_today"] = await oee_today(session, machine)
    if snapshot["since"] is None:
        snapshot["oee_today"] = dict.fromkeys(METRICS)
    return snapshot


def bucket_intervals(start, end, granularity, plant, shifts):
    tz = ZoneInfo(plant.timezone)
    if granularity == "shift" and shifts:
        return shift_intervals(shifts, plant.timezone, start, end, merge=False)
    if granularity == "hour":
        cursor = start.astimezone(tz).replace(minute=0, second=0, microsecond=0).astimezone(UTC)
        result = []
        while cursor < end:
            right = cursor + timedelta(hours=1)
            result.append((max(start, cursor), min(end, right)))
            cursor = right
        return result
    day = start.astimezone(tz).date()
    result = []
    while True:
        left = datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)
        right = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC)
        if left >= end:
            return result
        result.append((max(start, left), min(end, right)))
        day += timedelta(days=1)


async def oee_series(
    session, machine, start, end, granularity="hour", *, now=None, include_ideal_seconds=False
):
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ApiError(422, "VALIDATION_ERROR", "to")
    start, end = aware(start), aware(end)
    end = min(end, now or datetime.now(UTC))
    if end <= start:
        return []
    values = await load_window(session, machine, start, end)
    plant, shifts = values[:2]
    return [
        dict(
            bucket_start=iso(left),
            **window_totals(
                machine,
                *values[:5],
                left,
                right,
                runs=values[5],
                downtimes=values[6],
                include_ideal_seconds=include_ideal_seconds,
            ),
        )
        for left, right in bucket_intervals(start, end, granularity, plant, shifts)
    ]


SUMMARY_CACHE_SECONDS = 24 * 3600


def closed_day(plant, day, now=None):
    """Un día local ya terminado no cambia: su resumen puede guardarse en caché."""
    if day is None:
        return False
    now = now or datetime.now(UTC)
    return day < now.astimezone(ZoneInfo(plant.timezone)).date()


def summary_cache_key(plant, day):
    return f"plant:{plant.id}:summary:{day.isoformat()}"


async def cached_summary(key):
    try:
        async with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        ) as cache:
            raw = await cache.get(key)
    except RedisError:
        return None
    try:
        value = json.loads(raw) if raw else None
    except (ValueError, TypeError):
        return None
    if isinstance(value, dict) and "plant" in value and isinstance(value.get("machines"), list):
        return value
    return None


async def store_summary(key, value):
    try:
        payload = json.dumps(value)
        async with Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        ) as cache:
            await cache.set(key, payload, ex=SUMMARY_CACHE_SECONDS)
    except (RedisError, TypeError, ValueError):
        pass


async def plant_summary(session, plant, date: date | None = None):
    # Los días cerrados se sirven desde Redis; el día en curso siempre se recalcula.
    key = summary_cache_key(plant, date) if closed_day(plant, date) else None
    if key:
        cached = await cached_summary(key)
        if cached is not None:
            return cached
    start, end = day_window(plant, date)
    machines = list(
        await session.scalars(
            select(Machine).where(Machine.plant_id == plant.id).order_by(Machine.name, Machine.id)
        )
    )
    rows = []
    ideal_seconds = 0.0
    exact_standard = True
    for machine in machines:
        values = await machine_totals(session, machine, start, end, include_ideal_seconds=True)
        machine_ideal = values.pop("ideal_seconds")
        if machine_ideal is None:
            exact_standard = False
        else:
            ideal_seconds += machine_ideal
        snapshot = await observed_snapshot(session, machine)
        rows.append(
            dict(
                machine_id=machine.id,
                name=machine.name,
                slug=machine.slug,
                state=snapshot["state"],
                **values,
            )
        )
    totals = {
        key: sum(row[key] for row in rows) for key in ("good", "reject", "run_s", "planned_s")
    }
    total = totals["good"] + totals["reject"]
    aggregate = ratios(ideal_seconds / total if total else 0, **totals)
    if not exact_standard:
        aggregate.update(performance=None, oee=None)
    result = {"plant": aggregate, "machines": rows}
    if key:
        await store_summary(key, result)
    return result
