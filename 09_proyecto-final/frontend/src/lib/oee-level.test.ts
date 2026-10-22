import { describe, expect, it } from 'vitest';
import { oeeLevel, oeeTextClass } from './oee-level';

describe('oeeLevel', () => {
  it('separa los tres tramos del semáforo en 90 y 70', () => {
    expect(oeeLevel(0.9)).toBe('good');
    expect(oeeLevel(0.95)).toBe('good');
    expect(oeeLevel(0.899)).toBe('warn');
    expect(oeeLevel(0.7)).toBe('warn');
    expect(oeeLevel(0.699)).toBe('bad');
    expect(oeeLevel(0)).toBe('bad');
  });

  it('no clasifica valores ausentes ni no finitos', () => {
    expect(oeeLevel(null)).toBeNull();
    expect(oeeLevel(undefined)).toBeNull();
    expect(oeeLevel(Number.NaN)).toBeNull();
  });

  it('traduce el tramo a la clase de color y deja en gris lo ausente', () => {
    expect(oeeTextClass(0.92)).toBe('text-running');
    expect(oeeTextClass(0.75)).toBe('text-idle');
    expect(oeeTextClass(0.4)).toBe('text-down');
    expect(oeeTextClass(null)).toBe('text-muted');
  });
});
