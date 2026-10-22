import type { OeeRow, OeeTotals } from '@/lib/api/types';
import type { OeeCsvRow } from './csv';
import { parseDayKey } from './time';

interface Accumulator {
  good: number;
  reject: number;
  run_s: number;
  planned_s: number;
  idealWeighted: number;
  unknownIdeal: boolean;
}

export interface ReportTotals extends OeeTotals {
  ideal_s: number | null;
  capped: boolean;
}

// Totales con o sin los campos extra del reporte: sirve para filas por día (OeeRow) y por máquina.
export type ReportLike = OeeTotals & Partial<Pick<ReportTotals, 'ideal_s' | 'capped'>>;

function empty(): Accumulator {
  return { good: 0, reject: 0, run_s: 0, planned_s: 0, idealWeighted: 0, unknownIdeal: false };
}

// Misma regla que el resumen de planta: sumas de tiempos y piezas, rendimiento por tiempo ideal.
export function totalsOf(acc: Accumulator): ReportTotals {
  const total = acc.good + acc.reject;
  const availability = acc.planned_s > 0 ? acc.run_s / acc.planned_s : null;
  const rawPerformance = acc.run_s > 0 && !acc.unknownIdeal ? acc.idealWeighted / acc.run_s : null;
  const performance = rawPerformance === null ? null : Math.min(1, rawPerformance);
  const quality = total > 0 ? acc.good / total : null;
  const oee =
    availability !== null && performance !== null && quality !== null
      ? availability * performance * quality
      : null;
  return {
    availability,
    performance,
    quality,
    oee,
    good: acc.good,
    reject: acc.reject,
    run_s: acc.run_s,
    planned_s: acc.planned_s,
    ideal_s: acc.unknownIdeal ? null : acc.idealWeighted,
    capped: rawPerformance !== null && rawPerformance > 1,
  };
}

// `ideal_seconds` manda cuando el CSV lo trae; si la columna no existe (formato anterior) se usa
// el ciclo ideal de la máquina en s/pieza; una celda vacía deja el rendimiento desconocido.
function add(acc: Accumulator, row: OeeCsvRow, idealCycle: number) {
  const pieces = row.good + row.reject;
  acc.good += row.good;
  acc.reject += row.reject;
  acc.run_s += row.run_s;
  acc.planned_s += row.planned_s;
  if (row.ideal_seconds === undefined) acc.idealWeighted += idealCycle * pieces;
  else if (row.ideal_seconds === null) {
    if (pieces > 0) acc.unknownIdeal = true;
  } else acc.idealWeighted += row.ideal_seconds;
}

export function aggregateByDay(
  rows: OeeCsvRow[],
  idealCycles: Map<string, number>,
  timeZone: string,
): OeeRow[] {
  const days = new Map<string, Accumulator>();
  for (const row of rows) {
    const acc = days.get(row.date) ?? empty();
    add(acc, row, idealCycles.get(row.machine) ?? 0);
    days.set(row.date, acc);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => ({
      bucket_start: parseDayKey(date, timeZone).toISOString(),
      ...totalsOf(acc),
    }));
}

export interface MachineReportRow extends ReportTotals {
  machine: string;
}

export function aggregateByMachine(
  rows: OeeCsvRow[],
  idealCycles: Map<string, number>,
): MachineReportRow[] {
  const machines = new Map<string, Accumulator>();
  for (const row of rows) {
    const acc = machines.get(row.machine) ?? empty();
    add(acc, row, idealCycles.get(row.machine) ?? 0);
    machines.set(row.machine, acc);
  }
  return [...machines.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([machine, acc]) => ({ machine, ...totalsOf(acc) }));
}

export function aggregateAll(rows: OeeCsvRow[], idealCycles: Map<string, number>): ReportTotals {
  const acc = empty();
  for (const row of rows) add(acc, row, idealCycles.get(row.machine) ?? 0);
  return totalsOf(acc);
}

export interface ReportMatrix {
  days: string[];
  machines: string[];
  cells: Map<string, ReportTotals>;
}

export function matrixKey(date: string, machine: string): string {
  return `${date}|${machine}`;
}

// Día × máquina: una celda por combinación, para la vista de matriz y la hoja de Excel.
export function aggregateMatrix(rows: OeeCsvRow[], idealCycles: Map<string, number>): ReportMatrix {
  const groups = new Map<string, Accumulator>();
  const days = new Set<string>();
  const machines = new Set<string>();
  for (const row of rows) {
    days.add(row.date);
    machines.add(row.machine);
    const key = matrixKey(row.date, row.machine);
    const acc = groups.get(key) ?? empty();
    add(acc, row, idealCycles.get(row.machine) ?? 0);
    groups.set(key, acc);
  }
  const cells = new Map<string, ReportTotals>();
  for (const [key, acc] of groups) cells.set(key, totalsOf(acc));
  return {
    days: [...days].sort((a, b) => a.localeCompare(b)),
    machines: [...machines].sort((a, b) => a.localeCompare(b)),
    cells,
  };
}
