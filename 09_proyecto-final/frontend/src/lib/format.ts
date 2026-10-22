export const EMPTY_VALUE = '—';

const INTL_LOCALES: Record<string, string> = { es: 'es-MX', en: 'en-US' };

export function intlLocale(locale: string): string {
  return INTL_LOCALES[locale] ?? locale;
}

export function formatPercent(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatInteger(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value);
}

export function formatDecimal(
  value: number | null | undefined,
  locale: string,
  digits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

// Las unidades h, min y s se leen igual en español e inglés; no hace falta traducirlas.
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return EMPTY_VALUE;
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${secs} s`;
}

export function formatSince(since: string | null | undefined, now: Date | number): string {
  if (!since) return EMPTY_VALUE;
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return EMPTY_VALUE;
  return formatDuration((new Date(now).getTime() - start) / 1000);
}

export function formatDateTime(
  value: string | Date | number,
  timeZone: string,
  locale: string,
  style: 'short' | 'long' = 'short',
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    hourCycle: 'h23',
    day: '2-digit',
    month: style === 'long' ? 'long' : '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTime(
  value: string | Date | number,
  timeZone: string,
  locale: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(
  value: string | Date | number,
  timeZone: string,
  locale: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatClock(
  value: number | string | Date,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}
