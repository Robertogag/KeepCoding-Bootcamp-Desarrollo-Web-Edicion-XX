export interface OeeCsvRow {
  date: string;
  machine: string;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  good: number;
  reject: number;
  run_s: number;
  planned_s: number;
  // undefined = el CSV no trae la columna (formato anterior); null = celda vacía (desconocido).
  ideal_seconds?: number | null;
}

const LINE_FEED = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);
const BYTE_ORDER_MARK = 0xfeff;

// Separa una línea CSV respetando comillas dobles y comillas escapadas ("").
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function ratio(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseOeeCsv(text: string): OeeCsvRow[] {
  const clean = text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
  const lines = clean
    .split(LINE_FEED)
    .map((line) => (line.endsWith(CARRIAGE_RETURN) ? line.slice(0, -1) : line))
    .filter((line) => line.trim() !== '');
  const header = lines[0] ? splitCsvLine(lines[0]) : [];
  const column = (name: string) => header.indexOf(name);
  const at = (cells: string[], name: string) => {
    const index = column(name);
    return index === -1 ? undefined : cells[index];
  };
  const hasIdealColumn = column('ideal_seconds') !== -1;
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      date: at(cells, 'date') ?? '',
      machine: (at(cells, 'machine') ?? '').replace(/^'/, ''),
      availability: ratio(at(cells, 'availability')),
      performance: ratio(at(cells, 'performance')),
      quality: ratio(at(cells, 'quality')),
      oee: ratio(at(cells, 'oee')),
      good: integer(at(cells, 'good')),
      reject: integer(at(cells, 'reject')),
      run_s: integer(at(cells, 'run_s')),
      planned_s: integer(at(cells, 'planned_s')),
      // Tiempo ideal por piezas según cada corrida; una celda vacía significa desconocido.
      ideal_seconds: hasIdealColumn ? ratio(at(cells, 'ideal_seconds')) : undefined,
    };
  });
}

const CSV_COLUMNS = [
  'date',
  'machine',
  'availability',
  'performance',
  'quality',
  'oee',
  'good',
  'reject',
  'run_s',
  'planned_s',
  'ideal_seconds',
] as const;

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Mismo formato que el CSV del servidor: una fila por máquina y día, con BOM para Excel.
export function toOeeCsv(rows: OeeCsvRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((column) => csvCell(row[column])).join(','));
  }
  return String.fromCharCode(BYTE_ORDER_MARK) + lines.join(LINE_FEED) + LINE_FEED;
}

export interface DaySummaryMachine {
  name: string;
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  good: number;
  reject: number;
  run_s: number;
  planned_s: number;
}

// Filas a partir del resumen diario de planta: el tiempo ideal se reconstruye desde el rendimiento.
export function rowsFromDaySummaries(
  days: Array<{ date: string; machines: DaySummaryMachine[] }>,
): OeeCsvRow[] {
  const rows: OeeCsvRow[] = [];
  for (const day of days) {
    for (const machine of day.machines) {
      rows.push({
        date: day.date,
        machine: machine.name,
        availability: machine.availability,
        performance: machine.performance,
        quality: machine.quality,
        oee: machine.oee,
        good: machine.good,
        reject: machine.reject,
        run_s: machine.run_s,
        planned_s: machine.planned_s,
        ideal_seconds:
          machine.performance === null
            ? machine.good + machine.reject > 0
              ? null
              : 0
            : machine.performance * machine.run_s,
      });
    }
  }
  return rows;
}

// Días locales YYYY-MM-DD entre dos fechas, ambas incluidas; el tope evita rangos desmedidos.
export function listDays(fromDay: string, toDay: string, limit = 31): string[] {
  const days: string[] = [];
  const [fy, fm, fd] = fromDay.split('-').map(Number);
  const [ty, tm, td] = toDay.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return days;
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = Date.UTC(ty, tm - 1, td);
  while (cursor.getTime() <= end && days.length < limit) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
