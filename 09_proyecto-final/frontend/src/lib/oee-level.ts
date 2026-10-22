export type OeeLevel = 'good' | 'warn' | 'bad';

// Semáforo de planta: verde desde 90 %, ámbar entre 70 y 90, rojo por debajo.
export function oeeLevel(value: number | null | undefined): OeeLevel | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value >= 0.9) return 'good';
  if (value >= 0.7) return 'warn';
  return 'bad';
}

export const oeeLevelText: Record<OeeLevel, string> = {
  good: 'text-running',
  warn: 'text-idle',
  bad: 'text-down',
};

export function oeeTextClass(value: number | null | undefined): string {
  const level = oeeLevel(value);
  return level ? oeeLevelText[level] : 'text-muted';
}
