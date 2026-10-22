'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { OeeMetricsRow } from '@/components/oee/OeeMetricsRow';
import { EmptyState } from '@/components/state/EmptyState';
import { Clock } from '@/components/status/Clock';
import { StateCounters } from '@/components/status/StateCounters';
import { useNow } from '@/hooks/useNow';
import { ConnectionIndicator } from '@/components/realtime/ConnectionIndicator';
import { usePublicPlantSocket } from '@/components/realtime/usePublicPlantSocket';
import { getPublicPlant } from '@/lib/api/public';
import type { PublicPlant } from '@/lib/api/types';
import { formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { PublicMachineCard } from './PublicMachineCard';

export function PublicPlantBoard({ initial }: { initial: PublicPlant }) {
  const t = useTranslations('publicPlant');
  const tc = useTranslations('common');
  const locale = useLocale();
  const now = useNow(1000);
  const status = usePublicPlantSocket(initial.slug);
  const query = useQuery({
    queryKey: queryKeys.public.plant(initial.slug),
    queryFn: () => getPublicPlant(initial.slug),
    initialData: initial,
    // Con el socket en vivo solo se refresca el OEE agregado de la planta; sin él, todo el tablero cada 15 s.
    refetchInterval: status === 'live' ? 60_000 : 15_000,
  });
  const plant = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-3">
            {t('liveBoard')}
            <ConnectionIndicator status={status} />
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{plant.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {plant.timezone} · {tc('machines', { count: plant.machines.length })}
          </p>
        </div>
        <div className="text-right text-sm text-muted">
          <p className="flex items-baseline justify-end gap-2">
            <span className="eyebrow">{t('localTime')}</span>
            <Clock timeZone={plant.timezone} className="numeric text-fg" />
          </p>
          <p className="mt-0.5" suppressHydrationWarning>
            {t('updatedAt', {
              time: formatTime(query.dataUpdatedAt || now, plant.timezone, locale),
            })}
          </p>
        </div>
      </header>

      <section
        aria-labelledby="plant-oee"
        className="panel flex flex-wrap items-end justify-between gap-x-8 gap-y-4 p-4"
      >
        <div>
          <h2 id="plant-oee" className="eyebrow">
            {t('plantOee')}
          </h2>
          <OeeMetricsRow metrics={plant.oee_today} size="lg" className="mt-3" />
        </div>
        <StateCounters machines={plant.machines} />
      </section>

      {plant.machines.length === 0 ? (
        <EmptyState title={t('noMachinesTitle')} text={t('noMachinesText')} />
      ) : (
        <section aria-label={tc('machines', { count: plant.machines.length })}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plant.machines.map((machine) => (
              <PublicMachineCard
                key={machine.id}
                machine={machine}
                plantSlug={plant.slug}
                now={now}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
