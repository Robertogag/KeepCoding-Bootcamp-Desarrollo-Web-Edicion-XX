export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function localParts(date: Date | number, timeZone: string): LocalParts {
  const values: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: WEEKDAYS[values.weekday ?? ''] ?? 0,
  };
}

export function localDayKey(date: Date | number, timeZone: string): string {
  const { year, month, day } = localParts(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function offsetMs(utcMs: number, timeZone: string): number {
  const p = localParts(utcMs, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

export function zonedToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
  },
  timeZone: string,
): Date {
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  // Dos pasadas bastan para resolver el desfase incluso alrededor de un cambio de horario.
  let utc = asUtc - offsetMs(asUtc, timeZone);
  utc = asUtc - offsetMs(utc, timeZone);
  return new Date(utc);
}

export function startOfLocalDay(date: Date | number, timeZone: string): Date {
  const { year, month, day } = localParts(date, timeZone);
  return zonedToUtc({ year, month, day }, timeZone);
}

export function parseDayKey(key: string, timeZone: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return zonedToUtc({ year: year ?? 1970, month: month ?? 1, day: day ?? 1 }, timeZone);
}

export function addDays(date: Date | number, days: number): Date {
  return new Date(new Date(date).getTime() + days * 86_400_000);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}
