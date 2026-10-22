import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatSince,
  formatTime,
} from './format';

describe('formatPercent', () => {
  it('muestra un decimal y el símbolo de porcentaje', () => {
    expect(formatPercent(0.853, 'es')).toMatch(/^85[.,]3\s?%$/);
    expect(formatPercent(1, 'en')).toMatch(/^100[.,]0\s?%$/);
  });

  it('devuelve el guion cuando no hay valor', () => {
    expect(formatPercent(null, 'es')).toBe(EMPTY_VALUE);
    expect(formatPercent(undefined, 'en')).toBe(EMPTY_VALUE);
    expect(formatPercent(Number.NaN, 'en')).toBe(EMPTY_VALUE);
  });
});

describe('formatDuration', () => {
  it('elige la unidad según la magnitud', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min');
    expect(formatDuration(3905)).toBe('1 h 05 min');
    expect(formatDuration(90_000)).toBe('1 d 1 h');
  });

  it('no muestra valores negativos ni vacíos', () => {
    expect(formatDuration(-10)).toBe('0 s');
    expect(formatDuration(null)).toBe(EMPTY_VALUE);
  });
});

describe('formatSince', () => {
  it('mide desde el inicio del estado hasta ahora', () => {
    const now = Date.UTC(2026, 9, 20, 12, 0, 0);
    expect(formatSince('2026-10-20T11:15:00Z', now)).toBe('45 min');
    expect(formatSince(null, now)).toBe(EMPTY_VALUE);
  });
});

describe('fechas en la zona horaria de la planta', () => {
  it('convierte UTC a hora local de la planta', () => {
    expect(formatTime('2026-10-20T12:00:00Z', 'America/Mexico_City', 'es')).toBe('06:00');
    expect(formatTime('2026-10-20T12:00:00Z', 'Europe/Madrid', 'en')).toBe('14:00');
  });

  it('incluye fecha y hora en formato corto', () => {
    const value = formatDateTime('2026-10-20T12:00:00Z', 'America/Mexico_City', 'en');
    expect(value).toContain('10/20/2026');
    expect(value).toContain('06:00');
  });

  it('devuelve el guion para fechas inválidas', () => {
    expect(formatDateTime('nada', 'UTC', 'es')).toBe(EMPTY_VALUE);
  });
});
