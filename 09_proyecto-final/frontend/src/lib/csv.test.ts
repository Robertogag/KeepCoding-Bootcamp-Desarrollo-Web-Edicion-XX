import { describe, expect, it } from 'vitest';
import { listDays, parseOeeCsv, rowsFromDaySummaries, splitCsvLine, toOeeCsv } from './csv';
import { aggregateAll, aggregateByDay, aggregateByMachine } from './reports';

const sample =
  '﻿date,machine,availability,performance,quality,oee,good,reject,run_s,planned_s\r\n' +
  '2026-10-20,"Inyectora 01",0.9000,0.9500,0.9800,0.8379,1700,35,25920,28800\r\n' +
  '2026-10-20,"Prensa ""A"", grande",,,,,0,0,0,0\r\n' +
  '2026-10-21,"Inyectora 01",0.5000,1.0000,1.0000,0.5000,500,0,14400,28800\r\n';

describe('splitCsvLine', () => {
  it('respeta comillas y comillas escapadas', () => {
    expect(splitCsvLine('a,"b, c","d ""e"" f",,g')).toEqual(['a', 'b, c', 'd "e" f', '', 'g']);
  });
});

describe('parseOeeCsv', () => {
  it('ignora el BOM, lee celdas vacías como null y conserva los nombres', () => {
    const rows = parseOeeCsv(sample);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      date: '2026-10-20',
      machine: 'Inyectora 01',
      oee: 0.8379,
      good: 1700,
    });
    expect(rows[1]).toMatchObject({
      machine: 'Prensa "A", grande',
      availability: null,
      oee: null,
      good: 0,
    });
    expect(rows[0]?.ideal_seconds).toBeUndefined();
  });

  it('lee ideal_seconds cuando la columna existe y la deja en null si viene vacía', () => {
    const withColumn =
      'date,machine,availability,performance,quality,oee,good,reject,run_s,planned_s,ideal_seconds\r\n' +
      '2026-10-20,"Inyectora 01",0.9,0.9,0.9,0.729,100,0,1000,1200,650.5\r\n' +
      '2026-10-21,"Inyectora 01",0.9,0.9,0.9,0.729,100,0,1000,1200,\r\n';
    const rows = parseOeeCsv(withColumn);
    expect(rows[0]?.ideal_seconds).toBe(650.5);
    expect(rows[1]?.ideal_seconds).toBeNull();
  });
});

describe('agregados del reporte', () => {
  const rows = parseOeeCsv(sample);
  const ideal = new Map([['Inyectora 01', 28]]);

  it('agrupa por día con rendimiento ponderado por ciclo ideal', () => {
    const days = aggregateByDay(rows, ideal, 'UTC');
    expect(days.map((day) => day.bucket_start)).toEqual([
      '2026-10-20T00:00:00.000Z',
      '2026-10-21T00:00:00.000Z',
    ]);
    const first = days[0];
    expect(first?.availability).toBeCloseTo(0.9, 5);
    expect(first?.performance).toBeCloseTo(Math.min(1, (28 * 1735) / 25920), 5);
    expect(first?.quality).toBeCloseTo(1700 / 1735, 5);
  });

  it('agrupa por máquina y deja null cuando no hubo tiempo planificado', () => {
    const machines = aggregateByMachine(rows, ideal);
    expect(machines.map((row) => row.machine)).toEqual(['Inyectora 01', 'Prensa "A", grande']);
    expect(machines[0]?.good).toBe(2200);
    expect(machines[1]?.availability).toBeNull();
  });

  it('calcula el total del rango', () => {
    const total = aggregateAll(rows, ideal);
    expect(total.planned_s).toBe(57600);
    expect(total.availability).toBeCloseTo(40320 / 57600, 5);
  });
});

describe('toOeeCsv y resumen diario', () => {
  it('serializa con las columnas del servidor y vuelve a leerse igual', async () => {
    const { parseOeeCsv: parse } = await import('./csv');
    const rows = rowsFromDaySummaries([
      {
        date: '2026-10-20',
        machines: [
          {
            name: 'Inyectora, 01',
            availability: 0.9,
            performance: 0.5,
            quality: 1,
            oee: 0.45,
            good: 10,
            reject: 0,
            run_s: 1000,
            planned_s: 1200,
          },
          {
            name: 'Inyectora 02',
            availability: null,
            performance: null,
            quality: null,
            oee: null,
            good: 0,
            reject: 0,
            run_s: 0,
            planned_s: 0,
          },
        ],
      },
    ]);
    expect(rows[0]?.ideal_seconds).toBe(500);
    expect(rows[1]?.ideal_seconds).toBe(0);
    const text = toOeeCsv(rows);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.slice(1).split(String.fromCharCode(10))[0]).toBe(
      'date,machine,availability,performance,quality,oee,good,reject,run_s,planned_s,ideal_seconds',
    );
    const back = parse(text);
    expect(back).toHaveLength(2);
    expect(back[0]?.machine).toBe('Inyectora, 01');
    expect(back[1]?.availability).toBeNull();
  });

  it('lista los días locales del rango con tope', () => {
    expect(listDays('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(listDays('2026-10-01', '2026-12-31')).toHaveLength(31);
    expect(listDays('2026-10-05', '2026-10-01')).toEqual([]);
  });
});
