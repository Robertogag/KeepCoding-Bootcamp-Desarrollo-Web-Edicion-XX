import { describe, expect, it } from 'vitest';
import { connectionSchema, isHost, machineSchema } from './machine';

const t = (key: string) => key;
const schema = machineSchema(t);

const valid = {
  name: 'Inyectora 05',
  brand: 'Engel',
  model: 'Victory 330',
  host: 'simulator',
  port: '5020',
  unit_id: '5',
  ideal_cycle_s: '28.5',
  is_active: true,
};

function messageFor(input: unknown, field: string): string | undefined {
  const result = schema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe('machineSchema', () => {
  it('convierte los campos numéricos que llegan como texto del formulario', () => {
    const result = schema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ port: 5020, unit_id: 5, ideal_cycle_s: 28.5 });
    }
  });

  it('acota puerto y unit id', () => {
    expect(messageFor({ ...valid, port: '70000' }, 'port')).toBe('port');
    expect(messageFor({ ...valid, port: '0' }, 'port')).toBe('port');
    expect(messageFor({ ...valid, port: '50.5' }, 'port')).toBe('port');
    expect(messageFor({ ...valid, unit_id: '248' }, 'unit_id')).toBe('unitId');
  });

  it('acepta un decimal en el ciclo ideal, no más', () => {
    expect(schema.safeParse({ ...valid, ideal_cycle_s: '28.3' }).success).toBe(true);
    expect(messageFor({ ...valid, ideal_cycle_s: '28.25' }, 'ideal_cycle_s')).toBe('idealCycle');
    expect(messageFor({ ...valid, ideal_cycle_s: '0' }, 'ideal_cycle_s')).toBe('idealCycle');
    expect(messageFor({ ...valid, ideal_cycle_s: '3601' }, 'ideal_cycle_s')).toBe('idealCycle');
  });

  it('valida host como nombre o IPv4', () => {
    expect(isHost('10.0.0.12')).toBe(true);
    expect(isHost('inyectora-01.planta.local')).toBe(true);
    expect(isHost('256.1.1.1')).toBe(false);
    expect(isHost('host con espacios')).toBe(false);
    expect(messageFor({ ...valid, host: 'mal host!' }, 'host')).toBe('host');
  });

  it('acota nombre, marca y modelo', () => {
    expect(messageFor({ ...valid, name: 'A' }, 'name')).toBe('machineName');
    expect(messageFor({ ...valid, brand: 'x'.repeat(41) }, 'brand')).toBe('brand');
    expect(schema.safeParse({ ...valid, brand: '', model: '' }).success).toBe(true);
  });
});

describe('connectionSchema', () => {
  it('solo pide host, puerto y unit id', () => {
    const result = connectionSchema(t).safeParse({ host: '127.0.0.1', port: '502', unit_id: '1' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ host: '127.0.0.1', port: 502, unit_id: 1 });
  });
});
