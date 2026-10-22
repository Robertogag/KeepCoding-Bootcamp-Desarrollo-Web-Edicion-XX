import type {
  Granularity,
  OeeMetrics,
  OeeRow,
  OeeTotals,
  PlantSummary,
  Snapshot,
} from '@/lib/api/types';
import { localParts, startOfLocalDay, zonedToUtc } from '@/lib/time';
import {
  advance,
  db,
  floorMinute,
  isPlanned,
  MINUTE,
  type MockMachine,
  type MockPlant,
} from './data';

interface RawTotals {
  good: number;
  reject: number;
  run_s: number;
  planned_s: number;
  idealWeighted: number;
}

const HOUR = 3_600_000;

function emptyRaw(): RawTotals {
  return { good: 0, reject: 0, run_s: 0, planned_s: 0, idealWeighted: 0 };
}

export function metricsOf(raw: RawTotals): OeeMetrics {
  const total = raw.good + raw.reject;
  const availability = raw.planned_s > 0 ? raw.run_s / raw.planned_s : null;
  const performance = raw.run_s > 0 ? Math.min(1, raw.idealWeighted / raw.run_s) : null;
  const quality = total > 0 ? raw.good / total : null;
  const oee =
    availability !== null && performance !== null && quality !== null
      ? availability * performance * quality
      : null;
  return { availability, performance, quality, oee };
}

function toTotals(raw: RawTotals): OeeTotals {
  return {
    ...metricsOf(raw),
    good: raw.good,
    reject: raw.reject,
    run_s: raw.run_s,
    planned_s: raw.planned_s,
  };
}

function rawWindow(machine: MockMachine, plant: MockPlant, from: number, to: number): RawTotals {
  const raw = emptyRaw();
  const buckets = db.buckets.get(machine.id);
  if (!buckets) return raw;
  for (let minute = floorMinute(from); minute + MINUTE <= to; minute += MINUTE) {
    if (minute < from) continue;
    const bucket = buckets.get(minute);
    if (!bucket || !isPlanned(plant, minute)) continue;
    raw.planned_s += 60;
    raw.run_s += bucket.run_s;
    raw.good += bucket.good;
    raw.reject += bucket.reject;
    raw.idealWeighted += machine.ideal_cycle_s * (bucket.good + bucket.reject);
  }
  return raw;
}

export function windowTotals(
  machine: MockMachine,
  plant: MockPlant,
  from: number,
  to: number,
): OeeTotals {
  return toTotals(rawWindow(machine, plant, from, to));
}

export function nextLocalDay(ms: number, timeZone: string): number {
  const { year, month, day } = localParts(ms, timeZone);
  return zonedToUtc({ year, month, day: day + 1 }, timeZone).getTime();
}

function shiftWindows(plant: MockPlant, from: number, to: number): Array<[number, number]> {
  const shifts = db.shifts.filter((shift) => shift.plant_id === plant.id);
  const windows: Array<[number, number]> = [];
  let day = startOfLocalDay(from - 86_400_000, plant.timezone).getTime();
  while (day < to) {
    const parts = localParts(day, plant.timezone);
    for (const shift of shifts) {
      if (!shift.days_of_week.includes(parts.weekday)) continue;
      const [sh, sm] = shift.start_time.split(':').map(Number);
      const [eh, em] = shift.end_time.split(':').map(Number);
      const crosses = shift.end_time <= shift.start_time;
      const start = zonedToUtc(
        { year: parts.year, month: parts.month, day: parts.day, hour: sh ?? 0, minute: sm ?? 0 },
        plant.timezone,
      ).getTime();
      const end = zonedToUtc(
        {
          year: parts.year,
          month: parts.month,
          day: parts.day + (crosses ? 1 : 0),
          hour: eh ?? 0,
          minute: em ?? 0,
        },
        plant.timezone,
      ).getTime();
      const clippedStart = Math.max(start, from);
      const clippedEnd = Math.min(end, to);
      if (clippedStart < clippedEnd) windows.push([clippedStart, clippedEnd]);
    }
    day = nextLocalDay(day, plant.timezone);
  }
  return windows.sort((a, b) => a[0] - b[0]);
}

function windowsFor(
  plant: MockPlant,
  from: number,
  to: number,
  granularity: Granularity,
): Array<[number, number]> {
  const windows: Array<[number, number]> = [];
  if (granularity === 'hour') {
    for (let start = Math.floor(from / HOUR) * HOUR; start < to; start += HOUR) {
      windows.push([Math.max(start, from), Math.min(start + HOUR, to)]);
    }
    return windows;
  }
  const hasShifts = db.shifts.some((shift) => shift.plant_id === plant.id);
  if (granularity === 'shift' && hasShifts) return shiftWindows(plant, from, to);
  let start = startOfLocalDay(from, plant.timezone).getTime();
  while (start < to) {
    const end = nextLocalDay(start, plant.timezone);
    windows.push([Math.max(start, from), Math.min(end, to)]);
    start = end;
  }
  return windows;
}

export function series(
  machine: MockMachine,
  plant: MockPlant,
  from: number,
  to: number,
  granularity: Granularity,
): OeeRow[] {
  advance(Date.now());
  return windowsFor(plant, from, to, granularity).map(([start, end]) => ({
    bucket_start: new Date(start).toISOString(),
    ...windowTotals(machine, plant, start, end),
  }));
}

export function summary(
  plant: MockPlant,
  machines: MockMachine[],
  from: number,
  to: number,
): PlantSummary {
  advance(Date.now());
  const aggregate = emptyRaw();
  const rows = machines.map((machine) => {
    const raw = rawWindow(machine, plant, from, to);
    aggregate.good += raw.good;
    aggregate.reject += raw.reject;
    aggregate.run_s += raw.run_s;
    aggregate.planned_s += raw.planned_s;
    aggregate.idealWeighted += raw.idealWeighted;
    const engine = db.engines.get(machine.id);
    return {
      machine_id: machine.id,
      name: machine.name,
      slug: machine.slug,
      state: engine?.state ?? ('OFFLINE' as const),
      ...toTotals(raw),
    };
  });
  return { plant: toTotals(aggregate), machines: rows };
}

export function todayWindow(plant: MockPlant, now: number): [number, number] {
  return [startOfLocalDay(now, plant.timezone).getTime(), floorMinute(now)];
}

export function dayWindow(plant: MockPlant, dayStart: number, now: number): [number, number] {
  const end = nextLocalDay(dayStart, plant.timezone);
  return [dayStart, Math.min(end, floorMinute(now))];
}

export function oeeToday(machine: MockMachine, plant: MockPlant, now: number): OeeMetrics {
  const [from, to] = todayWindow(plant, now);
  return metricsOf(rawWindow(machine, plant, from, to));
}

export function snapshotFor(machine: MockMachine, plant: MockPlant, now: number): Snapshot {
  advance(now);
  const engine = db.engines.get(machine.id);
  if (!engine) {
    return {
      state: 'OFFLINE',
      since: null,
      good: 0,
      reject: 0,
      alarm_code: 0,
      last_cycle_s: null,
      oee_today: { availability: null, performance: null, quality: null, oee: null },
    };
  }
  const fraction = (now - floorMinute(now)) / MINUTE;
  const current = engine.current ?? { good: 0, reject: 0 };
  const running = engine.state === 'RUNNING';
  // El ciclo real oscila alrededor del ideal con un valor estable dentro del mismo segundo.
  const wobble = ((Math.floor(now / 1000) * 7919) % 100) / 100 - 0.5;
  return {
    state: engine.state,
    since: new Date(engine.segmentStart).toISOString(),
    good: engine.goodTotal + Math.floor(current.good * fraction),
    reject: engine.rejectTotal + Math.floor(current.reject * fraction),
    alarm_code: engine.state === 'DOWN' ? engine.alarm : 0,
    last_cycle_s: running
      ? Math.round(machine.ideal_cycle_s * (1 + machine.profile.jitter * wobble) * 10) / 10
      : null,
    oee_today: oeeToday(machine, plant, now),
  };
}
