import { describe, expect, it } from 'vitest';
import {
  isValidTimeZone,
  localDayKey,
  localParts,
  parseDayKey,
  startOfLocalDay,
  zonedToUtc,
} from './time';

const MX = 'America/Mexico_City';

describe('localParts', () => {
  it('descompone un instante en la hora local de la planta', () => {
    const parts = localParts(Date.UTC(2026, 9, 20, 5, 30, 15), MX);
    expect(parts).toMatchObject({
      year: 2026,
      month: 10,
      day: 19,
      hour: 23,
      minute: 30,
      second: 15,
    });
    expect(parts.weekday).toBe(1);
  });
});

describe('localDayKey', () => {
  it('usa el día local aunque en UTC ya sea el siguiente', () => {
    expect(localDayKey(Date.UTC(2026, 9, 20, 5, 30), MX)).toBe('2026-10-19');
    expect(localDayKey(Date.UTC(2026, 9, 20, 12, 0), MX)).toBe('2026-10-20');
  });
});

describe('zonedToUtc', () => {
  it('convierte una hora local a UTC', () => {
    expect(zonedToUtc({ year: 2026, month: 10, day: 20, hour: 6 }, MX).toISOString()).toBe(
      '2026-10-20T12:00:00.000Z',
    );
  });

  it('resuelve el desfase de verano en zonas con cambio de horario', () => {
    expect(
      zonedToUtc({ year: 2026, month: 7, day: 1, hour: 12 }, 'Europe/Madrid').toISOString(),
    ).toBe('2026-07-01T10:00:00.000Z');
    expect(
      zonedToUtc({ year: 2026, month: 1, day: 15, hour: 12 }, 'Europe/Madrid').toISOString(),
    ).toBe('2026-01-15T11:00:00.000Z');
  });

  it('acepta un día fuera de rango para avanzar al mes siguiente', () => {
    expect(zonedToUtc({ year: 2026, month: 10, day: 32 }, 'UTC').toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });
});

describe('startOfLocalDay y parseDayKey', () => {
  it('coinciden para el mismo día local', () => {
    const start = startOfLocalDay(Date.UTC(2026, 9, 20, 5, 30), MX);
    expect(start.toISOString()).toBe('2026-10-19T06:00:00.000Z');
    expect(parseDayKey('2026-10-19', MX).getTime()).toBe(start.getTime());
  });
});

describe('isValidTimeZone', () => {
  it('distingue zonas IANA válidas', () => {
    expect(isValidTimeZone(MX)).toBe(true);
    expect(isValidTimeZone('Planta/Inexistente')).toBe(false);
  });
});
