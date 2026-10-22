'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { OeeTrendChart } from '@/components/charts/OeeTrendChart';
import { ErrorState } from '@/components/state/ErrorState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { Skeleton } from '@/components/state/Skeleton';
import { useNow } from '@/hooks/useNow';
import { getMachineOee } from '@/lib/api/oee';
import type { Granularity } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query/keys';
import { addDays, startOfLocalDay } from '@/lib/time';

const GRANULARITIES: Granularity[] = ['hour', 'shift', 'day'];
const MINUTE = 60_000;

function windowFor(
  granularity: Granularity,
  nowMinute: number,
  timeZone: string,
): [string, string] {
  const to = new Date(nowMinute);
  if (granularity === 'hour') {
    return [new Date(nowMinute - 24 * 60 * MINUTE).toISOString(), to.toISOString()];
  }
  const days = granularity === 'shift' ? 7 : 30;
  return [startOfLocalDay(addDays(nowMinute, -days), timeZone).toISOString(), to.toISOString()];
}

export function OeeTrendPanel({ machineId, timeZone }: { machineId: number; timeZone: string }) {
  const t = useTranslations('trend');
  const describe = useErrorMessage();
  const [granularity, setGranularity] = useState<Granularity>('hour');
  const now = useNow(MINUTE);
  const nowMinute = Math.floor(now / MINUTE) * MINUTE;
  const [from, to] = useMemo(
    () => windowFor(granularity, nowMinute, timeZone),
    [granularity, nowMinute, timeZone],
  );

  const query = useQuery({
    queryKey: queryKeys.machines.oee(machineId, from, to, granularity),
    queryFn: () => getMachineOee(machineId, { from, to, granularity }),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <div
          role="group"
          aria-label={t('title')}
          className="flex rounded-md border border-line p-0.5"
        >
          {GRANULARITIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={granularity === item}
              onClick={() => setGranularity(item)}
              className={cn(
                'rounded px-3 py-1 text-sm font-medium',
                granularity === item ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {t(item)}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : query.isError ? (
        <ErrorState message={describe(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <div className={cn(query.isPlaceholderData && 'opacity-60')}>
          <OeeTrendChart
            rows={query.data}
            timeZone={timeZone}
            granularity={granularity}
            title={t(granularity)}
          />
        </div>
      )}
    </section>
  );
}
