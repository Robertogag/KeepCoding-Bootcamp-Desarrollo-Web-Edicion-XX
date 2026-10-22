import { describe, expect, it } from 'vitest';
import type { OeeCsvRow } from './csv';
import { aggregateAll, aggregateByMachine, aggregateMatrix, matrixKey } from './reports';

function row(partial: Partial<OeeCsvRow>): OeeCsvRow {
  return {
    date: '2026-10-20',
    machine: 'Inyectora 01',
    availability: null,
    performance: null,
    quality: null,
    oee: null,
    good: 0,
    reject: 0,
    run_s: 0,
    planned_s: 0,
    ...partial,
  };
}

describe('aggregateAll', () => {
  it('pondera el rendimiento con ideal_seconds cuando el CSV lo trae', () => {
    const rows = [
      row({ good: 100, reject: 0, run_s: 1000, planned_s: 1000, ideal_seconds: 700 }),
      row({
        date: '2026-10-21',
        good: 100,
        reject: 0,
        run_s: 1000,
        planned_s: 1000,
        ideal_seconds: 900,
      }),
    ];
    // Por máquina el ciclo ideal sería 28 s por pieza: 5600 s; la columna manda: 1600 / 2000.
    const totals = aggregateAll(rows, new Map([['Inyectora 01', 28]]));
    expect(totals.performance).toBeCloseTo(0.8, 6);
    expect(totals.oee).toBeCloseTo(0.8, 6);
    expect(totals.ideal_s).toBe(1600);
    expect(totals.capped).toBe(false);
  });

  it('vuelve al ciclo ideal de la máquina solo cuando la columna no existe', () => {
    const rows = [row({ good: 20, reject: 5, run_s: 1000, planned_s: 1000 })];
    const totals = aggregateAll(rows, new Map([['Inyectora 01', 28]]));
    expect(totals.performance).toBeCloseTo(0.7, 6);
  });

  it('una celda vacía deja el rendimiento y el OEE desconocidos, nunca en 100 %', () => {
    const rows = [row({ good: 100, reject: 0, run_s: 1000, planned_s: 1000, ideal_seconds: null })];
    const totals = aggregateAll(rows, new Map([['Inyectora 01', 28]]));
    expect(totals.performance).toBeNull();
    expect(totals.oee).toBeNull();
    expect(totals.ideal_s).toBeNull();
    expect(totals.availability).toBeCloseTo(1, 6);
  });

  it('nunca pasa de 1 aunque el tiempo ideal supere el de marcha, y lo señala', () => {
    const rows = [row({ good: 100, reject: 0, run_s: 500, planned_s: 1000, ideal_seconds: 900 })];
    const totals = aggregateAll(rows, new Map());
    expect(totals.performance).toBe(1);
    expect(totals.capped).toBe(true);
    expect(totals.availability).toBeCloseTo(0.5, 6);
  });
});

describe('aggregateByMachine', () => {
  it('mezcla renglones con y sin columna sin promediar porcentajes', () => {
    const rows = [
      row({ good: 50, reject: 0, run_s: 1000, planned_s: 1000, ideal_seconds: 500 }),
      row({ date: '2026-10-21', good: 50, reject: 0, run_s: 1000, planned_s: 1000 }),
    ];
    const [machine] = aggregateByMachine(rows, new Map([['Inyectora 01', 10]]));
    expect(machine?.performance).toBeCloseTo(0.5, 6);
    expect(machine?.good).toBe(100);
  });
});

describe('aggregateMatrix', () => {
  it('arma una celda por día y máquina con días y máquinas ordenados', () => {
    const rows = [
      row({ date: '2026-10-21', machine: 'B', good: 90, reject: 10, run_s: 900, planned_s: 1000 }),
      row({ date: '2026-10-20', machine: 'A', good: 50, reject: 0, run_s: 500, planned_s: 1000 }),
      row({ date: '2026-10-20', machine: 'A', good: 50, reject: 0, run_s: 500, planned_s: 1000 }),
    ];
    const matrix = aggregateMatrix(
      rows,
      new Map([
        ['A', 10],
        ['B', 9],
      ]),
    );
    expect(matrix.days).toEqual(['2026-10-20', '2026-10-21']);
    expect(matrix.machines).toEqual(['A', 'B']);
    const a = matrix.cells.get(matrixKey('2026-10-20', 'A'));
    expect(a?.good).toBe(100);
    expect(a?.availability).toBeCloseTo(0.5, 6);
    expect(a?.performance).toBeCloseTo(1, 6);
    expect(matrix.cells.get(matrixKey('2026-10-21', 'A'))).toBeUndefined();
    expect(matrix.cells.get(matrixKey('2026-10-21', 'B'))?.quality).toBeCloseTo(0.9, 6);
  });
});
