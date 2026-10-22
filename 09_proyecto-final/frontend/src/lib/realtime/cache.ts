import type { QueryClient } from '@tanstack/react-query';
import type { Machine, Paginated, SnapshotMessage, WatchlistItem } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { applySnapshotToList, applySnapshotToMachine } from './snapshots';

// Un snapshot actualiza la máquina, las listas de su planta y la lista de seguimiento sin pedir nada al API.
export function applySnapshotToCaches(queryClient: QueryClient, message: SnapshotMessage) {
  queryClient.setQueryData<Machine>(queryKeys.machines.detail(message.machine_id), (machine) =>
    applySnapshotToMachine(machine, message),
  );
  queryClient.setQueriesData<Paginated<Machine>>(
    { queryKey: ['plants', message.plant_id, 'machines'] },
    (list) => applySnapshotToList(list, message),
  );
  queryClient.setQueriesData<Paginated<WatchlistItem>>({ queryKey: queryKeys.watchlist }, (list) =>
    applySnapshotToList(list, message),
  );
}
