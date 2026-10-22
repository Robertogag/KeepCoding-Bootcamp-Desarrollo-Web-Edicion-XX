'use client';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Select } from '@/components/form/Field';
import { Pager } from '@/components/layout/Pager';
import { ClassifyEventDialog } from '@/components/machines/ClassifyEventDialog';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { Skeleton } from '@/components/state/Skeleton';
import { StateIndicator } from '@/components/status/StateIndicator';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/hooks/useNow';
import { Link } from '@/i18n/navigation';
import { listMachines } from '@/lib/api/machines';
import { listEvents } from '@/lib/api/oee';
import type { MachineEvent, MachineState } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE, formatDateTime, formatDuration } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

const ALL_MACHINES = { page_size: 100 };
const HOUR = 3_600_000;
const RANGES = { d1: 24 * HOUR, d7: 7 * 24 * HOUR, d30: 30 * 24 * HOUR } as const;
type RangeKey = keyof typeof RANGES;
type StopState = 'DOWN' | 'IDLE';
type StateFilter = StopState | 'both';
type ClassifiedFilter = 'all' | 'pending' | 'done';

interface StopRow {
  event: MachineEvent;
  machineName: string;
}

// Paros de máquina de toda la planta: fallas e inactividad leídas del equipo, con motivo,
// comentario y quién lo clasificó. Una consulta por máquina y estado, en paralelo.
export function MachineDowntimesPanel() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('downtimes.machineStops');
  const locale = useLocale();
  const now = useNow(60_000);
  const queryClient = useQueryClient();
  const [range, setRange] = useState<RangeKey>('d1');
  const [stateFilter, setStateFilter] = useState<StateFilter>('both');
  const [machineId, setMachineId] = useState('');
  const [classified, setClassified] = useState<ClassifiedFilter>('all');
  const [classifying, setClassifying] = useState<MachineEvent | null>(null);
  const [page, setPage] = useState(1);

  const machines = useQuery({
    queryKey: queryKeys.machines.list(plant.id, ALL_MACHINES),
    queryFn: () => listMachines(plant.id, ALL_MACHINES),
  });
  const machineList = useMemo(() => machines.data?.items ?? [], [machines.data]);
  const targets = machineId
    ? machineList.filter((machine) => String(machine.id) === machineId)
    : machineList;
  const states: StopState[] = stateFilter === 'both' ? ['DOWN', 'IDLE'] : [stateFilter];
  const nowMinute = Math.floor(now / 60_000) * 60_000;
  const from = new Date(nowMinute - RANGES[range]).toISOString();
  const to = new Date(nowMinute).toISOString();

  const queries = useQueries({
    queries: targets.flatMap((machine) =>
      states.map((state) => {
        const filters = { state: state as MachineState, from, to, page: 1, page_size: 50 };
        return {
          queryKey: queryKeys.machines.events(machine.id, filters),
          queryFn: () => listEvents(machine.id, filters),
          staleTime: 30_000,
        };
      }),
    ),
  });
  const loaded = queries.filter((query) => query.data).length;
  const pending = queries.some((query) => query.isPending);
  const nameOf = new Map(machineList.map((machine) => [machine.id, machine.name]));
  const rows: StopRow[] = queries
    .flatMap((query) => query.data?.items ?? [])
    .map((event) => ({ event, machineName: nameOf.get(event.machine_id) ?? '' }))
    .filter(({ event }) =>
      classified === 'all'
        ? true
        : classified === 'pending'
          ? !event.classified_by
          : !!event.classified_by,
    )
    .sort((a, b) => b.event.started_at.localeCompare(a.event.started_at));
  const truncated = queries.some((query) => query.data?.has_next);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * pageSize, current * pageSize);
  const pageData = {
    page: current,
    page_size: pageSize,
    total: rows.length,
    has_prev: current > 1,
    has_next: current < pages,
  };

  function reasonOf(event: MachineEvent): string {
    if (event.reason) return locale === 'en' ? event.reason.label_en : event.reason.label_es;
    return event.reason_code ? t('code', { code: event.reason_code }) : t('unclassified');
  }

  function durationOf(event: MachineEvent): number {
    const start = new Date(event.started_at).getTime();
    const end = event.ended_at ? new Date(event.ended_at).getTime() : now;
    return Math.max(0, (end - start) / 1000);
  }

  return (
    <section className="space-y-3" aria-labelledby="machine-stops">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="machine-stops" className="text-2xl font-extrabold tracking-tight">
            {t('title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="inline-flex rounded-md border border-line-strong p-0.5">
            {(Object.keys(RANGES) as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={range === key}
                onClick={() => {
                  setRange(key);
                  setPage(1);
                }}
                className={cn(
                  'numeric rounded px-3 py-1.5 text-[12px] font-bold',
                  range === key ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {t(`presets.${key}`)}
              </button>
            ))}
          </div>
          <label className="text-sm text-muted">
            {t('state')}
            <Select
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(event.target.value as StateFilter);
                setPage(1);
              }}
              className="mt-1 w-auto"
            >
              <option value="both">{t('both')}</option>
              <option value="DOWN">{t('down')}</option>
              <option value="IDLE">{t('idle')}</option>
            </Select>
          </label>
          <label className="text-sm text-muted">
            {t('classification')}
            <Select
              value={classified}
              onChange={(event) => {
                setClassified(event.target.value as ClassifiedFilter);
                setPage(1);
              }}
              className="mt-1 w-auto"
            >
              <option value="all">{t('allClassification')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="done">{t('done')}</option>
            </Select>
          </label>
          <label className="text-sm text-muted">
            {t('machine')}
            <Select
              value={machineId}
              onChange={(event) => {
                setMachineId(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-auto"
            >
              <option value="">{t('allMachines')}</option>
              {machineList.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      {machines.isPending || (loaded === 0 && pending) ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} text={t('emptyText')} />
      ) : (
        <div className={cn('panel overflow-x-auto', pending && 'opacity-80')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">{t('machine')}</th>
                <th className="px-3 py-2 font-medium">{t('state')}</th>
                <th className="px-3 py-2 font-medium">{t('start')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('duration')}</th>
                <th className="px-3 py-2 font-medium">{t('reason')}</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">{t('comment')}</th>
                <th className="px-3 py-2 font-medium">{t('by')}</th>
                {canEdit ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ event, machineName }) => (
                <tr key={event.id} className="border-b border-line/60">
                  <td className="px-3 py-2 font-bold">
                    <Link
                      href={`/app/plants/${plant.id}/machines/${event.machine_id}`}
                      className="hover:text-accent-text"
                    >
                      {machineName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StateIndicator state={event.state} variant="label" />
                  </td>
                  <td className="numeric px-3 py-2 whitespace-nowrap">
                    {formatDateTime(event.started_at, plant.timezone, locale)}
                  </td>
                  <td className="numeric px-3 py-2 text-right whitespace-nowrap">
                    {formatDuration(durationOf(event))}
                    {event.ended_at ? '' : <span className="text-muted"> · {t('ongoing')}</span>}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2',
                      !event.reason && !event.reason_code && 'text-muted italic',
                    )}
                  >
                    {reasonOf(event)}
                  </td>
                  <td className="hidden max-w-64 truncate px-3 py-2 text-muted md:table-cell">
                    {event.comment || EMPTY_VALUE}
                  </td>
                  <td className="numeric px-3 py-2 text-muted">
                    {event.classified_by ? `@${event.classified_by.username}` : EMPTY_VALUE}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setClassifying(event)}>
                        {t('classify')}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <p className="text-xs text-muted">
              {t('count', { count: rows.length })}
              {truncated ? ' · ' + t('truncated') : ''}
            </p>
            <Pager data={pageData} onPage={setPage} />
          </div>
        </div>
      )}

      {classifying ? (
        <ClassifyEventDialog
          event={classifying}
          onClose={() => {
            setClassifying(null);
            void queryClient.invalidateQueries({
              queryKey: ['machines', classifying.machine_id, 'events'],
            });
          }}
        />
      ) : null}
    </section>
  );
}
