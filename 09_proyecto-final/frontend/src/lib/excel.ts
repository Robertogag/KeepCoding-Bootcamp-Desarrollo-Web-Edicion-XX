import type { Borders, Cell, Fill, Row, Worksheet } from 'exceljs';
import type { OeeCsvRow } from './csv';
import { oeeLevel, type OeeLevel } from './oee-level';
import {
  aggregateAll,
  aggregateByDay,
  aggregateByMachine,
  aggregateMatrix,
  matrixKey,
  type ReportLike,
} from './reports';

type Lang = 'es' | 'en';

type LabelKey =
  | 'title'
  | 'subtitle'
  | 'plant'
  | 'timezone'
  | 'range'
  | 'machines'
  | 'all'
  | 'generated'
  | 'summary'
  | 'byMachine'
  | 'byDay'
  | 'matrix'
  | 'detail'
  | 'calc'
  | 'machine'
  | 'date'
  | 'oee'
  | 'availability'
  | 'performance'
  | 'quality'
  | 'good'
  | 'reject'
  | 'run'
  | 'planned'
  | 'ideal'
  | 'downtime'
  | 'total'
  | 'unknown'
  | 'kpis'
  | 'legend';
type Labels = Record<LabelKey, string>;

const TEXT: Record<Lang, Labels> = {
  es: {
    title: 'OEE Live',
    subtitle: 'Consulta de datos de OEE',
    plant: 'Planta',
    timezone: 'Zona horaria',
    range: 'Rango (días locales)',
    machines: 'Máquinas',
    all: 'Todas',
    generated: 'Generado',
    summary: 'Resumen',
    byMachine: 'Por máquina',
    byDay: 'Por día',
    matrix: 'Día x máquina',
    detail: 'Detalle',
    calc: 'Cálculo',
    machine: 'Máquina',
    date: 'Fecha',
    oee: 'OEE',
    availability: 'Disponibilidad',
    performance: 'Rendimiento',
    quality: 'Calidad',
    good: 'Piezas buenas',
    reject: 'Rechazos',
    run: 'En marcha (h:mm)',
    planned: 'Planificado (h:mm)',
    ideal: 'Tiempo ideal (h:mm)',
    downtime: 'Tiempo muerto (h:mm)',
    total: 'Total',
    unknown: 'sin dato',
    kpis: 'Indicadores del rango',
    legend: 'Semáforo: verde desde 90 %, ámbar de 70 a 89,9 %, rojo por debajo de 70 %.',
  },
  en: {
    title: 'OEE Live',
    subtitle: 'OEE data query',
    plant: 'Plant',
    timezone: 'Time zone',
    range: 'Range (local days)',
    machines: 'Machines',
    all: 'All',
    generated: 'Generated',
    summary: 'Summary',
    byMachine: 'By machine',
    byDay: 'By day',
    matrix: 'Day x machine',
    detail: 'Detail',
    calc: 'Calculation',
    machine: 'Machine',
    date: 'Date',
    oee: 'OEE',
    availability: 'Availability',
    performance: 'Performance',
    quality: 'Quality',
    good: 'Good pieces',
    reject: 'Rejects',
    run: 'Running (h:mm)',
    planned: 'Planned (h:mm)',
    ideal: 'Ideal time (h:mm)',
    downtime: 'Downtime (h:mm)',
    total: 'Total',
    unknown: 'no data',
    kpis: 'Range indicators',
    legend: 'Traffic light: green from 90 %, amber from 70 to 89.9 %, red below 70 %.',
  },
};

const CALC: Record<Lang, string[]> = {
  es: [
    'OEE = Disponibilidad × Rendimiento × Calidad',
    'Disponibilidad = tiempo en marcha ÷ tiempo planificado',
    'Rendimiento = tiempo ideal ÷ tiempo en marcha (tiempo ideal = piezas × estándar en s/pieza; limitado a 100 %)',
    'Calidad = piezas buenas ÷ (piezas buenas + rechazos)',
    'El estándar por pieza es el ciclo ideal de la corrida ÷ cavidades activas; sin corrida, el estándar base de la máquina.',
    'Los totales suman tiempos y piezas de todos los renglones antes de dividir; no son promedios de porcentajes.',
    'Un periodo sin tiempo planificado o sin estándar conocido queda "sin dato" en vez de inventar un valor.',
    'Fuente: resumen diario de OEE de la planta (una fila por máquina y día local), el mismo de la pantalla.',
  ],
  en: [
    'OEE = Availability × Performance × Quality',
    'Availability = running time ÷ planned time',
    'Performance = ideal time ÷ running time (ideal time = pieces × standard in s/piece; capped at 100 %)',
    'Quality = good pieces ÷ (good pieces + rejects)',
    'The standard per piece is the run ideal cycle ÷ active cavities; without a run, the machine base standard.',
    'Totals add times and pieces of every row before dividing; they are not averages of percentages.',
    'A period without planned time or without a known standard stays "no data" instead of inventing a value.',
    'Source: the daily plant OEE summary (one row per machine and local day), the same the screen uses.',
  ],
};

export interface ExcelReportInput {
  plantName: string;
  timeZone: string;
  fromDay: string;
  toDay: string;
  allMachines: boolean;
  machines: string[];
  rows: OeeCsvRow[];
  idealCycles: Map<string, number>;
  locale: string;
  generatedAt: Date;
}

const COLOR = {
  ink: '0F172A',
  band: '1E293B',
  accent: '2563EB',
  muted: '64748B',
  line: 'E2E8F0',
  zebra: 'F8FAFC',
  tile: 'EEF2F7',
  total: 'E2E8F0',
  good: 'DCFCE7',
  goodInk: '166534',
  warn: 'FEF3C7',
  warnInk: '92400E',
  bad: 'FEE2E2',
  badInk: '991B1B',
  white: 'FFFFFF',
};
const FONT = 'Calibri';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function solid(color: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
}

const thin = { style: 'thin' as const, color: { argb: `FF${COLOR.line}` } };
const BORDER: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function font(options: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}) {
  return {
    name: FONT,
    size: options.size ?? 11,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: { argb: `FF${options.color ?? COLOR.ink}` },
  };
}

function levelColors(level: OeeLevel): { fill: string; ink: string } {
  if (level === 'good') return { fill: COLOR.good, ink: COLOR.goodInk };
  if (level === 'warn') return { fill: COLOR.warn, ink: COLOR.warnInk };
  return { fill: COLOR.bad, ink: COLOR.badInk };
}

function fillColor(cell: Cell): string | undefined {
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
  return fill?.fgColor?.argb;
}

function unknownCell(cell: Cell, text: string) {
  cell.value = text;
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.font = font({ italic: true, color: COLOR.muted });
}

function percentCell(cell: Cell, value: number | null, unknown: string, strong = false) {
  cell.border = BORDER;
  if (value === null) return unknownCell(cell, unknown);
  cell.value = value;
  cell.numFmt = '0.0%';
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  const level = oeeLevel(value);
  if (level) {
    const colors = levelColors(level);
    cell.fill = solid(colors.fill);
    cell.font = font({ bold: true, color: colors.ink });
  } else {
    cell.font = font({ bold: strong });
  }
}

function countCell(cell: Cell, value: number, strong = false) {
  cell.value = value;
  cell.numFmt = '#,##0';
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.border = BORDER;
  cell.font = font({ bold: strong });
}

function durationCell(cell: Cell, seconds: number | null, unknown: string, strong = false) {
  cell.border = BORDER;
  if (seconds === null) return unknownCell(cell, unknown);
  cell.value = seconds / 86400;
  cell.numFmt = '[h]:mm';
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  cell.font = font({ bold: strong });
}

function dateCell(cell: Cell, day: string, strong = false) {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  cell.value = new Date(Date.UTC(year, month - 1, date));
  cell.numFmt = 'dd/mm/yyyy';
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
  cell.border = BORDER;
  cell.font = font({ bold: strong });
}

function labelCell(cell: Cell, text: string, strong = false) {
  cell.value = text;
  cell.font = font({ bold: strong });
  cell.alignment = { vertical: 'middle' };
  cell.border = BORDER;
}

function headerRow(sheet: Worksheet, labels: string[]): Row {
  const row = sheet.addRow(labels);
  row.height = 32;
  row.eachCell((cell) => {
    cell.fill = solid(COLOR.band);
    cell.font = font({ bold: true, color: COLOR.white });
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });
  return row;
}

// Filas alternas en gris muy claro; las celdas con semáforo conservan su color.
function zebra(row: Row, index: number, columns: number) {
  if (index % 2 === 1) return;
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    if (!fillColor(cell)) cell.fill = solid(COLOR.zebra);
  }
}

function totalRowStyle(row: Row, columns: number) {
  row.height = 20;
  for (let column = 1; column <= columns; column += 1) {
    const cell = row.getCell(column);
    const current = fillColor(cell);
    if (!current || current === `FF${COLOR.zebra}`) cell.fill = solid(COLOR.total);
    cell.font = { ...font({ bold: true }), color: cell.font?.color ?? font().color };
    cell.border = { ...BORDER, top: { style: 'medium', color: { argb: `FF${COLOR.band}` } } };
  }
}

function metricsRow(
  sheet: Worksheet,
  first: string | ((cell: Cell) => void),
  totals: ReportLike,
  unknown: string,
  strong = false,
): Row {
  const row = sheet.addRow([]);
  row.height = 18;
  if (typeof first === 'string') labelCell(row.getCell(1), first, strong);
  else first(row.getCell(1));
  percentCell(row.getCell(2), totals.oee, unknown, true);
  percentCell(row.getCell(3), totals.availability, unknown, strong);
  percentCell(row.getCell(4), totals.performance, unknown, strong);
  percentCell(row.getCell(5), totals.quality, unknown, strong);
  countCell(row.getCell(6), totals.good, strong);
  countCell(row.getCell(7), totals.reject, strong);
  durationCell(row.getCell(8), totals.run_s, unknown, strong);
  durationCell(row.getCell(9), totals.planned_s, unknown, strong);
  durationCell(row.getCell(10), totals.ideal_s ?? null, unknown, strong);
  durationCell(row.getCell(11), Math.max(0, totals.planned_s - totals.run_s), unknown, strong);
  return row;
}

function metricColumns(T: Labels, first: string): string[] {
  return [
    first,
    T.oee,
    T.availability,
    T.performance,
    T.quality,
    T.good,
    T.reject,
    T.run,
    T.planned,
    T.ideal,
    T.downtime,
  ];
}

function setup(sheet: Worksheet, tab: string, widths: number[]) {
  sheet.properties.tabColor = { argb: `FF${tab}` };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
}

function sectionTitle(sheet: Worksheet, row: number, text: string) {
  const cell = sheet.getCell(row, 1);
  cell.value = text.toUpperCase();
  cell.font = font({ bold: true, size: 10, color: COLOR.muted });
}

// Indicador grande en dos filas: rótulo arriba, valor abajo; el OEE lleva el color del semáforo.
function kpiTile(
  sheet: Worksheet,
  row: number,
  column: number,
  label: string,
  value: number | null,
  unknown: string,
  level: OeeLevel | null,
) {
  sheet.mergeCells(row, column, row, column + 1);
  sheet.mergeCells(row + 1, column, row + 1, column + 1);
  const top = sheet.getCell(row, column);
  const bottom = sheet.getCell(row + 1, column);
  const colors = level ? levelColors(level) : { fill: COLOR.tile, ink: COLOR.ink };
  top.value = label.toUpperCase();
  top.font = font({ bold: true, size: 9, color: COLOR.muted });
  top.alignment = { horizontal: 'center', vertical: 'bottom' };
  top.fill = solid(colors.fill);
  if (value === null) {
    bottom.value = unknown;
    bottom.font = font({ italic: true, size: 14, color: COLOR.muted });
  } else {
    bottom.value = value;
    bottom.numFmt = '0.0%';
    bottom.font = font({ bold: true, size: 22, color: colors.ink });
  }
  bottom.alignment = { horizontal: 'center', vertical: 'top' };
  bottom.fill = solid(colors.fill);
}

export async function buildOeeWorkbook(input: ExcelReportInput): Promise<Blob> {
  const lang: Lang = input.locale.startsWith('en') ? 'en' : 'es';
  const T = TEXT[lang];
  const unknown = T.unknown;
  const mod = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = mod.default ?? mod;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OEE Live';
  workbook.created = input.generatedAt;

  const range = aggregateAll(input.rows, input.idealCycles);
  const days = aggregateByDay(input.rows, input.idealCycles, input.timeZone);
  const perMachine = aggregateByMachine(input.rows, input.idealCycles);
  const matrix = aggregateMatrix(input.rows, input.idealCycles);
  const machinesLabel = input.allMachines ? T.all : input.machines.join(', ');
  const widths = [26, 12, 15, 15, 12, 14, 12, 16, 17, 17, 18];

  // Resumen: banda de título, ficha, indicadores y tabla por máquina.
  const summary = workbook.addWorksheet(T.summary, { views: [{ showGridLines: false }] });
  setup(summary, COLOR.band, widths);
  summary.mergeCells('A1:K2');
  const title = summary.getCell('A1');
  title.value = `${T.title} · ${T.subtitle}`;
  title.fill = solid(COLOR.band);
  title.font = font({ bold: true, size: 18, color: COLOR.white });
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summary.getRow(1).height = 24;
  summary.getRow(2).height = 24;
  summary.mergeCells('A3:K3');
  const plantLine = summary.getCell('A3');
  plantLine.value = `${input.plantName}  ·  ${input.fromDay} – ${input.toDay}`;
  plantLine.fill = solid(COLOR.accent);
  plantLine.font = font({ bold: true, size: 12, color: COLOR.white });
  plantLine.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summary.getRow(3).height = 22;

  const meta: Array<[string, string]> = [
    [T.plant, input.plantName],
    [T.timezone, input.timeZone],
    [T.range, `${input.fromDay} – ${input.toDay}`],
    [T.machines, machinesLabel],
    [T.generated, input.generatedAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
  ];
  let line = 5;
  for (const [label, value] of meta) {
    const key = summary.getCell(line, 1);
    key.value = label;
    key.font = font({ bold: true, size: 10, color: COLOR.muted });
    const valueCell = summary.getCell(line, 2);
    valueCell.value = value;
    valueCell.font = font({ size: 10 });
    summary.mergeCells(line, 2, line, 11);
    line += 1;
  }

  line += 1;
  sectionTitle(summary, line, T.kpis);
  line += 1;
  kpiTile(summary, line, 1, T.oee, range.oee, unknown, oeeLevel(range.oee));
  kpiTile(summary, line, 3, T.availability, range.availability, unknown, null);
  kpiTile(summary, line, 5, T.performance, range.performance, unknown, null);
  kpiTile(summary, line, 7, T.quality, range.quality, unknown, null);
  summary.mergeCells(line, 9, line, 10);
  summary.mergeCells(line + 1, 9, line + 1, 10);
  const piecesTop = summary.getCell(line, 9);
  piecesTop.value = `${T.good} / ${T.reject}`.toUpperCase();
  piecesTop.font = font({ bold: true, size: 9, color: COLOR.muted });
  piecesTop.alignment = { horizontal: 'center', vertical: 'bottom' };
  piecesTop.fill = solid(COLOR.tile);
  const piecesBottom = summary.getCell(line + 1, 9);
  piecesBottom.value = `${range.good.toLocaleString(lang)} / ${range.reject.toLocaleString(lang)}`;
  piecesBottom.font = font({ bold: true, size: 16 });
  piecesBottom.alignment = { horizontal: 'center', vertical: 'top' };
  piecesBottom.fill = solid(COLOR.tile);
  summary.getRow(line).height = 16;
  summary.getRow(line + 1).height = 34;
  line += 3;
  summary.mergeCells(line, 1, line, 11);
  const legend = summary.getCell(line, 1);
  legend.value = T.legend;
  legend.font = font({ italic: true, size: 9, color: COLOR.muted });
  line += 2;
  sectionTitle(summary, line, T.byMachine);
  line += 1;
  headerRow(summary, metricColumns(T, T.machine));
  perMachine.forEach((row, index) =>
    zebra(metricsRow(summary, row.machine, row, unknown), index, 11),
  );
  totalRowStyle(metricsRow(summary, T.total, range, unknown, true), 11);

  // Por día
  const byDay = workbook.addWorksheet(T.byDay, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  setup(byDay, COLOR.accent, [14, ...widths.slice(1)]);
  headerRow(byDay, metricColumns(T, T.date));
  days.forEach((row, index) =>
    zebra(
      metricsRow(
        byDay,
        (cell) => dateCell(cell, row.bucket_start.slice(0, 10), true),
        row,
        unknown,
      ),
      index,
      11,
    ),
  );
  totalRowStyle(metricsRow(byDay, T.total, range, unknown, true), 11);
  byDay.autoFilter = { from: 'A1', to: `K${days.length + 1}` };

  // Día x máquina
  const grid = workbook.addWorksheet(T.matrix, {
    views: [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  setup(grid, '0EA5E9', [14, ...matrix.machines.map(() => 16), 12]);
  headerRow(grid, [T.date, ...matrix.machines, T.total]);
  const dayTotals = new Map(days.map((row) => [row.bucket_start.slice(0, 10), row]));
  matrix.days.forEach((day, index) => {
    const row = grid.addRow([]);
    row.height = 18;
    dateCell(row.getCell(1), day, true);
    matrix.machines.forEach((machine, column) => {
      const cell = matrix.cells.get(matrixKey(day, machine));
      percentCell(row.getCell(column + 2), cell ? cell.oee : null, unknown);
    });
    const total = dayTotals.get(day);
    percentCell(row.getCell(matrix.machines.length + 2), total ? total.oee : null, unknown, true);
    zebra(row, index, matrix.machines.length + 2);
  });
  const totalRow = grid.addRow([]);
  labelCell(totalRow.getCell(1), T.total, true);
  matrix.machines.forEach((machine, column) => {
    const totals = perMachine.find((row) => row.machine === machine);
    percentCell(totalRow.getCell(column + 2), totals ? totals.oee : null, unknown, true);
  });
  percentCell(totalRow.getCell(matrix.machines.length + 2), range.oee, unknown, true);
  totalRowStyle(totalRow, matrix.machines.length + 2);

  // Detalle: una fila por máquina y día
  const detail = workbook.addWorksheet(T.detail, {
    views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }],
  });
  setup(detail, COLOR.muted, [14, 26, ...widths.slice(1)]);
  headerRow(detail, [T.date, ...metricColumns(T, T.machine)]);
  const sorted = [...input.rows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.machine.localeCompare(b.machine),
  );
  sorted.forEach((row, index) => {
    const cells = detail.addRow([]);
    cells.height = 18;
    dateCell(cells.getCell(1), row.date);
    labelCell(cells.getCell(2), row.machine, true);
    percentCell(cells.getCell(3), row.oee, unknown, true);
    percentCell(cells.getCell(4), row.availability, unknown);
    percentCell(cells.getCell(5), row.performance, unknown);
    percentCell(cells.getCell(6), row.quality, unknown);
    countCell(cells.getCell(7), row.good);
    countCell(cells.getCell(8), row.reject);
    durationCell(cells.getCell(9), row.run_s, unknown);
    durationCell(cells.getCell(10), row.planned_s, unknown);
    durationCell(cells.getCell(11), row.ideal_seconds ?? null, unknown);
    durationCell(cells.getCell(12), Math.max(0, row.planned_s - row.run_s), unknown);
    zebra(cells, index, 12);
  });
  detail.autoFilter = { from: 'A1', to: `L${sorted.length + 1}` };

  // Cálculo
  const calc = workbook.addWorksheet(T.calc, { views: [{ showGridLines: false }] });
  setup(calc, '94A3B8', [110]);
  calc.getCell('A1').value = T.calc;
  calc.getCell('A1').font = font({ bold: true, size: 14 });
  calc.getRow(1).height = 24;
  for (const text of CALC[lang]) {
    const row = calc.addRow([text]);
    row.getCell(1).font = font();
    row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    row.height = 18;
  }
  const legendRow = calc.addRow([T.legend]);
  legendRow.getCell(1).font = font({ italic: true, color: COLOR.muted });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as BlobPart], { type: MIME });
}
