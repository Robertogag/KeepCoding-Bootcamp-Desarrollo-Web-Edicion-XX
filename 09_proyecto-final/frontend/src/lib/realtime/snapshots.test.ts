import { describe, expect, it } from 'vitest';
import type {
  Paginated,
  PublicMachine,
  PublicPlant,
  Snapshot,
  SnapshotMessage,
} from '@/lib/api/types';
import {
  applySnapshotToList,
  applySnapshotToMachine,
  applySnapshotToPublicPlant,
  isSnapshotMessage,
} from './snapshots';

const idle: Snapshot = {
  state: 'IDLE',
  since: '2026-10-21T10:00:00Z',
  good: 100,
  reject: 2,
  alarm_code: 0,
  last_cycle_s: null,
  oee_today: { availability: 0.5, performance: 0.9, quality: 0.98, oee: 0.44 },
};

const running: Snapshot = {
  ...idle,
  state: 'RUNNING',
  since: '2026-10-21T10:05:00Z',
  good: 130,
  last_cycle_s: 28.1,
};

function machine(id: number, snapshot: Snapshot): PublicMachine {
  return { id, slug: `m-${id}`, name: `M ${id}`, brand: '', model: '', photo: null, snapshot };
}

const message: SnapshotMessage = {
  type: 'machine.snapshot',
  plant_id: 1,
  machine_id: 2,
  snapshot: running,
  ts: '2026-10-21T10:05:02Z',
};

describe('applySnapshotToMachine', () => {
  it('reemplaza el snapshot de la máquina del mensaje', () => {
    const result = applySnapshotToMachine(machine(2, idle), message);
    expect(result?.snapshot).toBe(running);
  });

  it('devuelve la misma referencia cuando el mensaje es de otra máquina o no hay caché', () => {
    const other = machine(3, idle);
    expect(applySnapshotToMachine(other, message)).toBe(other);
    expect(applySnapshotToMachine(undefined, message)).toBeUndefined();
  });
});

describe('applySnapshotToList', () => {
  const list: Paginated<PublicMachine> = {
    items: [machine(1, idle), machine(2, idle), machine(3, idle)],
    page: 1,
    page_size: 20,
    total: 3,
    has_next: false,
    has_prev: false,
  };

  it('actualiza solo el elemento afectado sin mutar la lista original', () => {
    const result = applySnapshotToList(list, message);
    expect(result).not.toBe(list);
    expect(result?.items[1]?.snapshot).toBe(running);
    expect(result?.items[0]).toBe(list.items[0]);
    expect(list.items[1]?.snapshot).toBe(idle);
  });

  it('no cambia nada si la máquina no está en la página', () => {
    expect(applySnapshotToList(list, { ...message, machine_id: 99 })).toBe(list);
  });
});

describe('applySnapshotToPublicPlant', () => {
  const plant: PublicPlant = {
    id: 1,
    slug: 'planta',
    name: 'Planta',
    timezone: 'UTC',
    oee_today: idle.oee_today,
    machines: [machine(1, idle), machine(2, idle)],
  };

  it('actualiza la máquina dentro de la planta pública', () => {
    const result = applySnapshotToPublicPlant(plant, message);
    expect(result?.machines[1]?.snapshot.state).toBe('RUNNING');
  });

  it('ignora mensajes de otra planta', () => {
    expect(applySnapshotToPublicPlant(plant, { ...message, plant_id: 7 })).toBe(plant);
  });
});

describe('isSnapshotMessage', () => {
  it('reconoce el formato del servidor y rechaza el resto', () => {
    expect(isSnapshotMessage(message)).toBe(true);
    expect(isSnapshotMessage({ type: 'ping' })).toBe(false);
    expect(isSnapshotMessage({ type: 'machine.snapshot', machine_id: '2' })).toBe(false);
    expect(isSnapshotMessage(null)).toBe(false);
  });
});
