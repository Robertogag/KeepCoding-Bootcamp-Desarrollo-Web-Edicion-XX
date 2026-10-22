'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pager } from '@/components/layout/Pager';
import { MachineCard } from '@/components/machines/MachineCard';
import { usePlantSubscription } from '@/components/realtime/RealtimeProvider';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { QueryState } from '@/components/state/QueryState';
import { SkeletonCardGrid } from '@/components/state/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/hooks/useNow';
import { Link } from '@/i18n/navigation';
import { listWatchlist, unfollowMachine } from '@/lib/api/watchlist';
import { queryKeys } from '@/lib/query/keys';

function PlantSubscription({ plantId }: { plantId: number }) {
  usePlantSubscription(plantId);
  return null;
}

export function WatchlistPanel() {
  const t = useTranslations('watchlist');
  const tf = useTranslations('follow');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...queryKeys.watchlist, page],
    queryFn: () => listWatchlist(page),
  });

  const unfollow = useMutation({
    mutationFn: (machineId: number) => unfollowMachine(machineId),
    onSuccess: async (_data, machineId) => {
      toast({ title: t('unfollowed'), variant: 'success' });
      // Si era la última de la página, volver a la anterior para no dejar una página vacía.
      if (page > 1 && (query.data?.items.length ?? 0) <= 1) setPage(page - 1);
      queryClient.removeQueries({ queryKey: queryKeys.machines.detail(machineId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  const plantIds = [...new Set((query.data?.items ?? []).map((item) => item.plant.id))];

  return (
    <div className="space-y-4">
      {plantIds.map((plantId) => (
        <PlantSubscription key={plantId} plantId={plantId} />
      ))}
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>
      <QueryState
        query={query}
        skeleton={<SkeletonCardGrid count={3} />}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState title={t('emptyTitle')} text={t('emptyText')} />}
      >
        {(data) => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <MachineCard
                  key={item.id}
                  machine={item}
                  href={`/app/plants/${item.plant.id}/machines/${item.id}`}
                  now={now}
                  footer={
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                      <Link
                        href={`/app/plants/${item.plant.id}`}
                        className="truncate text-muted hover:text-fg"
                      >
                        {t('plant')}: {item.plant.name}
                      </Link>
                      <PendingButton
                        variant="ghost"
                        size="sm"
                        pending={unfollow.isPending && unfollow.variables === item.id}
                        onClick={() => unfollow.mutate(item.id)}
                      >
                        {tf('unfollow')}
                      </PendingButton>
                    </div>
                  }
                />
              ))}
            </div>
            <Pager data={data} onPage={setPage} />
          </div>
        )}
      </QueryState>
    </div>
  );
}
