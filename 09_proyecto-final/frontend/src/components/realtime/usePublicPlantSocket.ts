import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { PublicPlant } from '@/lib/api/types';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/query/keys';
import { RealtimeClient, type RealtimeStatus } from '@/lib/realtime/client';
import { applySnapshotToPublicPlant } from '@/lib/realtime/snapshots';

// El tablero público abre su propio socket sin credenciales y escribe directo en la caché de la planta.
export function usePublicPlantSocket(slug: string): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('offline');

  useEffect(() => {
    const client = new RealtimeClient({
      url: async () => `${env.wsUrl}/public/${encodeURIComponent(slug)}`,
      onStatus: setStatus,
      onMessage: (message) => {
        if (message.type !== 'machine.snapshot') return;
        queryClient.setQueryData<PublicPlant>(queryKeys.public.plant(slug), (plant) =>
          applySnapshotToPublicPlant(plant, message),
        );
      },
    });
    client.start();
    return () => client.stop();
  }, [slug, queryClient]);

  return status;
}
