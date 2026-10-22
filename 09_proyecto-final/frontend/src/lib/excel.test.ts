import { Workbook } from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import type { OeeCsvRow } from './csv';
import { buildOeeWorkbook } from './excel';

// En Node se usa el paquete principal; el de navegador solo existe para el bundle del cliente.
vi.mock('exceljs/dist/exceljs.min.js', async () => await import('exceljs'));

function row(partial: Partial<OeeCsvRow>): OeeCsvRow {
  return {
    date: '2026-10-20',
    machine: 'Inyectora 01',
    availability: 0.9,
    performance: 0.95,
    quality: 0.98,
    oee: 0.84,
    good: 100,
    reject: 2,
    run_s: 3600,
    planned_s: 4000,
    ideal_seconds: 3400,
    ...partial,
  };
}

describe('buildOeeWorkbook', () => {
  it('genera un libro con las cinco hojas, formatos y semáforo', async () => {
    const blob = await buildOeeWorkbook({
      plantName: 'Planta Demo',
      timeZone: 'America/Mexico_City',
      fromDay: '2026-10-20',
      toDay: '2026-10-21',
      allMachines: true,
      machines: ['Inyectora 01', 'Inyectora 02'],
      rows: [
        row({}),
        row({ machine: 'Inyectora 02', good: 50, reject: 50, run_s: 1800, ideal_seconds: 900 }),
        row({
          date: '2026-10-21',
          good: 0,
          reject: 0,
          run_s: 0,
          planned_s: 0,
          ideal_seconds: null,
        }),
      ],
      idealCycles: new Map([
        ['Inyectora 01', 28],
        ['Inyectora 02', 30],
      ]),
      locale: 'es',
      generatedAt: new Date('2026-10-22T07:00:00Z'),
    });
    expect(blob.size).toBeGreaterThan(5000);

    const workbook = new Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Resumen',
      'Por día',
      'Día x máquina',
      'Detalle',
      'Cálculo',
    ]);

    const summary = workbook.getWorksheet('Resumen');
    expect(summary?.getCell('A1').value).toBe('OEE Live · Consulta de datos de OEE');
    const byDay = workbook.getWorksheet('Por día');
    const oeeCell = byDay?.getCell('B2');
    expect(oeeCell?.numFmt).toBe('0.0%');
    expect(typeof oeeCell?.value).toBe('number');
    // El 21 no tiene tiempo planificado ni estándar: queda "sin dato", no cero.
    expect(byDay?.getCell('B3').value).toBe('sin dato');
    const runCell = byDay?.getCell('H2');
    expect(runCell?.numFmt).toBe('[h]:mm');

    const grid = workbook.getWorksheet('Día x máquina');
    expect(grid?.getCell('B1').value).toBe('Inyectora 01');
    expect(grid?.getCell('C1').value).toBe('Inyectora 02');
    expect(grid?.getCell('D1').value).toBe('Total');
    expect(grid?.getCell('C3').value).toBe('sin dato');
  });
});
