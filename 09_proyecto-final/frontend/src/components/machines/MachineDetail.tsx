'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { StateTimeline } from '@/components/charts/StateTimeline';
import { Counter } from '@/components/oee/Counter';
import { OeeMetricsRow } from '@/components/oee/OeeMetricsRow';
import { usePlant } from '@/components/plants/PlantContext';
import { ResponsivePhoto } from '@/components/public/ResponsivePhoto';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { SinceLabel } from '@/components/status/SinceLabel';
import { StateIndicator } from '@/components/status/StateIndicator';
import { buttonClasses } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { Link } from '@/i18n/navigation';
import { getMachine } from '@/lib/api/machines';
import { listEvents } from '@/lib/api/oee';
import type { MachineEvent } from '@/lib/api/types';
import { EMPTY_VALUE, formatDecimal, formatInteger } from '@/lib/format';
import { stateStyles } from '@/lib/machine-state';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/cn';
import { ClassifyEventDialog } from './ClassifyEventDialog';
import { ShotsCounter } from './ShotsCounter';
import { DeleteMachineButton } from './DeleteMachineButton';
import { EventsTable } from './EventsTable';
import { FollowButton } from './FollowButton';
import { LineStopBanner } from './LineStopBanner';
import { OeeTrendPanel } from './OeeTrendPanel';
import { ProductionContextPanel } from './ProductionContextPanel';
import { TelemetryPanel } from './TelemetryPanel';

const EIGHT_HOURS = 8 * 3_600_000;
const MINUTE = 60_000;

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Skeleton className="aspect-[3/2] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function MachineDetail({ machineId }: { machineId: number }) {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('machine');
  const tm = useTranslations('machines');
  const th = useTranslations('history');
  const locale = useLocale();
  const now = useNow(MINUTE);
  const { status } = useRealtime();
  const nowMinute = Math.floor(now / MINUTE) * MINUTE;
  const from = nowMinute - EIGHT_HOURS;
  const [classifying, setClassifying] = useState<MachineEvent | null>(null);

  const query = useQuery({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => getMachine(machineId),
    refetchInterval: status === 'live' ? 60_000 : 10_000,
  });

  const timelineFilters = {
    from: new Date(from).toISOString(),
    to: new Date(nowMinute).toISOString(),
    page_size: 100,
  };
  const timeline = useQuery({
    queryKey: queryKeys.machines.events(machineId, timelineFilters),
    queryFn: () => listEvents(machineId, timelineFilters),
    refetchInterval: 30_000,
  });

  return (
    <QueryState query={query} skeleton={<DetailSkeleton />}>
      {(machine) => {
        const { snapshot } = machine;
        const model = [machine.brand, machine.model].filter(Boolean).join(' ');
        return (
          <div className="space-y-6">
            <nav>
              <Link
                href={`/app/plants/${plant.id}/machines`}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
              >
                <IconChevronLeft className="size-4" />
                {tm('backToList')}
              </Link>
            </nav>

            <header className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">{tm('machineLabel')}</p>
                  <h2 className="text-2xl font-extrabold tracking-tight">{machine.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {model || EMPTY_VALUE}
                    {!machine.is_active ? ` · ${tm('inactive')}` : ''}
                  </p>
                  <p className="numeric mt-1 text-xs text-muted">
                    {machine.host}:{machine.port} · {tm('form.unitId')} {machine.unit_id}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FollowButton machine={machine} />
                  <Link
                    href={`/app/plants/${plant.id}/machines/${machine.id}/history`}
                    className={buttonClasses('secondary', 'sm')}
                  >
                    {th('link')}
                  </Link>
                  {canEdit ? (
                    <>
                      <Link
                        href={`/app/plants/${plant.id}/machines/${machine.id}/edit`}
                        className={buttonClasses('secondary', 'sm')}
                      >
                        {tm('edit')}
                      </Link>
                      <DeleteMachineButton
                        machine={machine}
                        redirectTo={`/app/plants/${plant.id}/machines`}
                        variant="secondary"
                      />
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
                <StateIndicator
                  state={snapshot.state}
                  size="lg"
                  variant="label"
                  className={stateStyles[snapshot.state].text}
                />
                <span className="text-sm text-muted">
                  {t('since')} <SinceLabel since={snapshot.since} className="numeric text-fg" />
                </span>
                {snapshot.state === 'DOWN' && snapshot.alarm_code > 0 ? (
                  <span className="chip text-down">
                    {t('alarm', { code: snapshot.alarm_code })}
                  </span>
                ) : null}
              </div>
            </header>

            <LineStopBanner plantId={plant.id} machineId={machine.id} />

            {timeline.data ? (
              <StateTimeline
                events={timeline.data.items}
                from={from}
                to={nowMinute}
                timeZone={plant.timezone}
                onSelect={
                  canEdit
                    ? (event) => {
                        if (event.state === 'DOWN') setClassifying(event);
                      }
                    : undefined
                }
              />
            ) : (
              <Skeleton className="h-36 w-full" />
            )}

            <div className={cn('grid gap-6', machine.photo && 'lg:grid-cols-[2fr_3fr]')}>
              {machine.photo ? (
                <ResponsivePhoto
                  photo={machine.photo}
                  state={snapshot.state}
                  alt={machine.name}
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
              ) : null}
              <div className="space-y-4">
                <section aria-labelledby="machine-oee" className="panel p-4">
                  <h3 id="machine-oee" className="eyebrow">
                    {t('oeeToday')}
                  </h3>
                  <OeeMetricsRow metrics={snapshot.oee_today} size="lg" className="mt-3" />
                </section>
                <section aria-labelledby="machine-counters" className="panel p-4">
                  <h3 id="machine-counters" className="eyebrow">
                    {t('counters')}
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <ShotsCounter machineId={machine.id} />
                    <Counter label={t('good')} value={formatInteger(snapshot.good, locale)} />
                    <Counter label={t('reject')} value={formatInteger(snapshot.reject, locale)} />
                    <Counter
                      label={t('lastCycle')}
                      value={
                        snapshot.last_cycle_s === null
                          ? EMPTY_VALUE
                          : formatDecimal(snapshot.last_cycle_s, locale)
                      }
                      unit={snapshot.last_cycle_s === null ? undefined : 's'}
                    />
                    <Counter
                      label={t('idealCycle')}
                      value={formatDecimal(machine.ideal_cycle_s, locale)}
                      unit="s"
                    />
                  </dl>
                  <p className="mt-3 text-xs text-muted">{t('countersHint')}</p>
                </section>
              </div>
            </div>

            <ProductionContextPanel
              machine={machine}
              plantId={plant.id}
              timeZone={plant.timezone}
              canEdit={canEdit}
            />

            <TelemetryPanel machineId={machine.id} plantId={plant.id} timeZone={plant.timezone} />

            <OeeTrendPanel machineId={machine.id} timeZone={plant.timezone} />

            <EventsTable machineId={machine.id} timeZone={plant.timezone} canEdit={canEdit} />

            {classifying ? (
              <ClassifyEventDialog
                key={classifying.id}
                event={classifying}
                onClose={() => setClassifying(null)}
              />
            ) : null}
          </div>
        );
      }}
    </QueryState>
  );
}
