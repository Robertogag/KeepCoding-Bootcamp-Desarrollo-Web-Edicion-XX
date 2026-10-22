'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { buttonClasses } from '@/components/ui/Button';
import { IconArrowRight } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { getPlant } from '@/lib/api/plants';
import { queryKeys } from '@/lib/query/keys';
import { usePlantSubscription } from '@/components/realtime/RealtimeProvider';
import { PlantProvider } from './PlantContext';
import { ConfigNav, PlantNav } from './PlantNav';

function PlantSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function PlantLayout({ plantId, children }: { plantId: number; children: ReactNode }) {
  const t = useTranslations('plants');
  const tApp = useTranslations('app');
  usePlantSubscription(plantId);
  const query = useQuery({
    queryKey: queryKeys.plants.detail(plantId),
    queryFn: () => getPlant(plantId),
  });

  return (
    <QueryState query={query} skeleton={<PlantSkeleton />}>
      {(plant) => (
        <PlantProvider plant={plant}>
          <div className="space-y-3">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-[26px] leading-tight font-extrabold tracking-tight">
                  {plant.name}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="chip text-accent-text">{tApp(`role.${plant.role}`)}</span>
                  {plant.role === 'viewer' ? (
                    <span className="chip text-muted">{tApp('readOnlyShort')}</span>
                  ) : null}
                </p>
              </div>
              {plant.is_public ? (
                <Link href={`/plants/${plant.slug}`} className={buttonClasses('secondary', 'sm')}>
                  {t('publicLink')}
                  <IconArrowRight className="size-4" />
                </Link>
              ) : null}
            </header>
            <PlantNav plant={plant} />
            <ConfigNav plant={plant} />
            <div className="pt-2">{children}</div>
          </div>
        </PlantProvider>
      )}
    </QueryState>
  );
}
