import { HttpResponse } from 'msw';
import type {
  BoardMachine,
  BoardPosition,
  BoardStop,
  MachineState,
  PlantBoardData,
  SeriesCounts,
  SeriesPoint,
  TelemetryQuality,
  TelemetrySeries,
} from '@/lib/api/types';
import { db, isPlanned, machinesOf } from './data';
import type { MockTools } from './handlers';
import {
  idealSecondsPerPiece,
  injectionDb,
  lineOf,
  openRunOf,
  sampleAt,
  TELEMETRY_STEP,
} from './injection-data';
import { snapshotFor } from './oee';

const DAY = 86_400_000;
const ROTATIONS = [0, 90, 180, 270];
const positions = new Map<number, BoardPosition[]>();

function emptyCounts(): SeriesCounts {
  return { good: 0, bad: 0, stale: 0, unavailable: 0, missing: 0 };
}

export function createBoardHandlers(tools: MockTools) {
  const {
    handle,
    readBody,
    idParam,
    parseInstant,
    currentUser,
    requireMembership,
    requireMachine,
  } = tools;

  function fail(status: number, code: string, field?: string): never {
    return tools.fail(status, code, field);
  }

  return [
    handle('get', '/plants/:plantId/board', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      const now = Date.now();
      const saved = positions.get(plant.id) ?? [];
      const states: Record<MachineState, number> = { RUNNING: 0, IDLE: 0, DOWN: 0, OFFLINE: 0 };
      const machines: BoardMachine[] = machinesOf(plant.id).map((machine) => {
        const snapshot = snapshotFor(machine, plant, now);
        states[snapshot.state] += 1;
        const run = openRunOf(machine.id) ?? null;
        return {
          id: machine.id,
          name: machine.name,
          slug: machine.slug,
          brand: machine.brand,
          model: machine.model,
          is_active: machine.is_active,
          line_id: lineOf(machine.id),
          position: saved.find((item) => item.machine_id === machine.id) ?? null,
          snapshot,
          observed_at: snapshot.state === 'OFFLINE' ? null : new Date(now).toISOString(),
          current_run: run
            ? {
                id: run.id,
                order_id: run.order_id,
                order_code:
                  injectionDb.orders.find((order) => order.id === run.order_id)?.code ?? '',
                product_id: run.context.product_id,
                product_code: run.context.product_code,
                product_name: run.context.product_name,
                mold_id: run.mold_id,
                mold_code: run.context.mold_code,
                mold_name: run.context.mold_name ?? null,
                nominal_cavities: run.nominal_cavities,
                active_cavities: run.active_cavities,
                ideal_cycle_s: run.ideal_cycle_s,
                ideal_seconds_per_piece: idealSecondsPerPiece(run),
                started_at: run.started_at,
              }
            : null,
        };
      });
      const stops: BoardStop[] = [
        ...injectionDb.downtimes
          .filter((item) => item.plant_id === plant.id && item.ended_at === null)
          .map((item): BoardStop => {
            const reason = db.reasons.find((entry) => entry.code === item.reason_code);
            return {
              kind: 'line',
              id: item.id,
              line_id: item.line_id,
              machine_id: null,
              affected_machine_ids: item.affected_machine_ids,
              started_at: item.started_at,
              elapsed_s: Math.floor((now - new Date(item.started_at).getTime()) / 1000),
              reason_code: item.reason_code,
              label_es: reason?.label_es ?? null,
              label_en: reason?.label_en ?? null,
              planned: item.planned,
              comment: item.comment,
            };
          }),
        ...machines
          .filter((machine) => machine.snapshot.state === 'DOWN')
          .map((machine): BoardStop => ({
            kind: 'machine',
            id: null,
            line_id: machine.line_id,
            machine_id: machine.id,
            affected_machine_ids: [machine.id],
            started_at: machine.snapshot.since,
            elapsed_s: machine.snapshot.since
              ? Math.floor((now - new Date(machine.snapshot.since).getTime()) / 1000)
              : null,
            reason_code: null,
            label_es: null,
            label_en: null,
            planned: null,
            comment: null,
          })),
      ];
      const active = machines.filter((machine) => machine.is_active);
      const body: PlantBoardData = {
        generated_at: new Date(now).toISOString(),
        plant: { id: plant.id, slug: plant.slug, name: plant.name, timezone: plant.timezone },
        scheduled_now: isPlanned(plant, now),
        summary: {
          machine_count: machines.length,
          active_machine_count: active.length,
          states,
          active_runs: active.filter((machine) => machine.current_run !== null).length,
          without_active_run: active.filter((machine) => machine.current_run === null).length,
          line_stops: stops.filter((stop) => stop.kind === 'line').length,
          oee_today: tools.plantOeeToday(plant, now),
        },
        lines: injectionDb.lines
          .filter((line) => line.plant_id === plant.id)
          .map((line) => ({
            id: line.id,
            code: line.code,
            name: line.name,
            is_active: line.is_active,
          })),
        machines,
        stops,
      };
      return HttpResponse.json(body);
    }),

    handle('get', '/plants/:plantId/layout', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      return HttpResponse.json({ plant_id: plant.id, positions: positions.get(plant.id) ?? [] });
    }),

    handle('put', '/plants/:plantId/layout', async ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'), [
        'owner',
        'supervisor',
      ]);
      const body = await readBody(request);
      const raw = body.positions;
      if (!Array.isArray(raw)) fail(422, 'VALIDATION_ERROR', 'positions');
      const ids = new Set(machinesOf(plant.id).map((machine) => machine.id));
      const seen = new Set<number>();
      const next: BoardPosition[] = raw.map((entry: unknown) => {
        const item = (entry ?? {}) as Record<string, unknown>;
        const machineId = Number(item.machine_id);
        const x = Number(item.x);
        const y = Number(item.y);
        const width = Number(item.width);
        const height = Number(item.height);
        const rotation = item.rotation === undefined ? 0 : Number(item.rotation);
        if (!ids.has(machineId) || seen.has(machineId)) fail(422, 'VALIDATION_ERROR', 'machine_id');
        seen.add(machineId);
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) fail(422, 'VALIDATION_ERROR', 'x');
        if (!(width > 0 && height > 0 && x + width <= 1 && y + height <= 1))
          fail(422, 'VALIDATION_ERROR', 'width');
        if (!ROTATIONS.includes(rotation)) fail(422, 'VALIDATION_ERROR', 'rotation');
        return {
          machine_id: machineId,
          x,
          y,
          width,
          height,
          rotation: rotation as BoardPosition['rotation'],
          updated_at: new Date().toISOString(),
        };
      });
      positions.set(plant.id, next);
      return HttpResponse.json({ plant_id: plant.id, positions: next });
    }),

    handle('get', '/machines/:machineId/telemetry/series', ({ request, params }) => {
      const user = currentUser(request);
      const { machine } = requireMachine(user, idParam(params, 'machineId'));
      const url = new URL(request.url);
      for (const key of url.searchParams.keys()) {
        if (!['from', 'to', 'codes', 'max_points', 'bucket_s', 'run_id'].includes(key)) {
          fail(422, 'VALIDATION_ERROR', key);
        }
      }
      const from = parseInstant(url.searchParams.get('from'), 'from');
      const to = parseInstant(url.searchParams.get('to'), 'to');
      if (from >= to || to - from > 31 * DAY) fail(422, 'VALIDATION_ERROR', 'to');
      const codes = url.searchParams.getAll('codes');
      if (codes.length < 1 || codes.length > 12) fail(422, 'VALIDATION_ERROR', 'codes');
      const maxPoints = Number(url.searchParams.get('max_points') ?? '600');
      if (!Number.isInteger(maxPoints) || maxPoints < 10 || maxPoints > 2000) {
        fail(422, 'VALIDATION_ERROR', 'max_points');
      }
      const requestedBucket = url.searchParams.get('bucket_s');
      let bucketS = requestedBucket === null ? 0 : Number(requestedBucket);
      if (requestedBucket !== null && (!Number.isInteger(bucketS) || bucketS < 10)) {
        fail(422, 'VALIDATION_ERROR', 'bucket_s');
      }
      const runParam = url.searchParams.get('run_id');
      const runId = runParam === null ? null : Number(runParam);
      if (
        runId !== null &&
        !injectionDb.runs.some((run) => run.id === runId && run.machine_id === machine.id)
      ) {
        fail(422, 'VALIDATION_ERROR', 'run_id');
      }
      const spanS = (to - from) / 1000;
      if (bucketS === 0) bucketS = Math.max(10, Math.ceil(spanS / maxPoints / 10) * 10);
      const bucketCount = Math.ceil(spanS / bucketS);
      if (bucketCount * codes.length > 24_000) fail(422, 'VALIDATION_ERROR', 'max_points');

      const end = Math.min(to, Date.now());
      const variables = injectionDb.variables.filter((item) => item.machine_id === machine.id);
      const series: TelemetrySeries[] = codes.map((code) => {
        const variable = variables.find((item) => item.code === code);
        const points: SeriesPoint[] = [];
        for (let start = from; start < to; start += bucketS * 1000) {
          const stop = Math.min(start + bucketS * 1000, to);
          const counts = emptyCounts();
          let sum = 0;
          let min: number | null = null;
          let max: number | null = null;
          let first: number | null = null;
          let last: number | null = null;
          let firstAt: string | null = null;
          let lastAt: string | null = null;
          const firstStep = Math.ceil(start / TELEMETRY_STEP) * TELEMETRY_STEP;
          for (let at = firstStep; at < stop && at < end; at += TELEMETRY_STEP) {
            const sample = sampleAt(machine.id, at);
            if (runId !== null && sample.run_id !== runId) continue;
            const reading = sample.values[code];
            if (!reading) {
              counts.missing += 1;
              continue;
            }
            counts[reading.quality as TelemetryQuality] += 1;
            if (reading.quality !== 'good' || reading.value === null) continue;
            sum += reading.value;
            min = min === null ? reading.value : Math.min(min, reading.value);
            max = max === null ? reading.value : Math.max(max, reading.value);
            if (first === null) {
              first = reading.value;
              firstAt = sample.sampled_at;
            }
            last = reading.value;
            lastAt = sample.sampled_at;
          }
          points.push({
            bucket_start: new Date(start).toISOString(),
            bucket_end: new Date(stop).toISOString(),
            avg: counts.good > 0 ? Math.round((sum / counts.good) * 1000) / 1000 : null,
            min,
            max,
            first,
            last,
            first_at: firstAt,
            last_at: lastAt,
            counts,
          });
        }
        return {
          code,
          unit: variable?.unit ?? null,
          map_version: variable?.map_version ?? null,
          mapping_key: variable ? `${variable.map_version}:${variable.address}` : null,
          points,
        };
      });
      return HttpResponse.json({
        machine_id: machine.id,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        bucket_s: bucketS,
        requested_codes: codes,
        series,
      });
    }),
  ];
}
