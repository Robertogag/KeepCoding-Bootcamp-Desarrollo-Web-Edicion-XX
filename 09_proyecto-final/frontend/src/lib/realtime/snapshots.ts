import type {
  Machine,
  Paginated,
  PublicMachine,
  PublicPlant,
  Snapshot,
  SnapshotMessage,
} from '@/lib/api/types';

type WithSnapshot = { id: number; snapshot: Snapshot };

// Reductores puros: reciben lo que hay en caché y devuelven la misma referencia si el mensaje no aplica.
export function applySnapshotToMachine<T extends WithSnapshot>(
  machine: T | undefined,
  message: SnapshotMessage,
): T | undefined {
  if (!machine || machine.id !== message.machine_id) return machine;
  return { ...machine, snapshot: message.snapshot };
}

export function applySnapshotToList<T extends WithSnapshot>(
  list: Paginated<T> | undefined,
  message: SnapshotMessage,
): Paginated<T> | undefined {
  if (!list || !Array.isArray(list.items)) return list;
  const index = list.items.findIndex((item) => item.id === message.machine_id);
  if (index === -1) return list;
  const items = list.items.slice();
  items[index] = { ...list.items[index], snapshot: message.snapshot } as T;
  return { ...list, items };
}

export function applySnapshotToPublicPlant(
  plant: PublicPlant | undefined,
  message: SnapshotMessage,
): PublicPlant | undefined {
  if (!plant || plant.id !== message.plant_id) return plant;
  const index = plant.machines.findIndex((item) => item.id === message.machine_id);
  if (index === -1) return plant;
  const machines: PublicMachine[] = plant.machines.slice();
  machines[index] = { ...plant.machines[index], snapshot: message.snapshot } as PublicMachine;
  return { ...plant, machines };
}

export function isSnapshotMessage(value: unknown): value is SnapshotMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<SnapshotMessage>;
  return (
    message.type === 'machine.snapshot' &&
    typeof message.machine_id === 'number' &&
    typeof message.plant_id === 'number' &&
    !!message.snapshot &&
    typeof message.snapshot === 'object'
  );
}

export type MachineLike = Machine | PublicMachine;
