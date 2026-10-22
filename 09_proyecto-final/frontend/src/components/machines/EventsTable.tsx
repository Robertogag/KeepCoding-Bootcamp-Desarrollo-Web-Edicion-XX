'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Input, Select } from '@/components/form/Field';
import { EmptyState } from '@/components/state/EmptyState';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { StateIndicator } from '@/components/status/StateIndicator';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import { listEvents } from '@/lib/api/oee';
import type { EventFilters, MachineEvent } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDuration } from '@/lib/format';
import { isMachineState, MACHINE_STATES } from '@/lib/machine-state';
import { queryKeys } from '@/lib/query/keys';
import { addDays, parseDayKey } from '@/lib/time';
import { ClassifyEventDialog } from './ClassifyEventDialog';

interface EventsTableProps {
  machineId: number;
  timeZone: string;
  canEdit: boolean;
}

export function EventsTable({ machineId, timeZone, canEdit }: EventsTableProps) {
  const t = useTranslations('events');
  const tp = useTranslations('pagination');
  const ts = useTranslations('machineState');
  const locale = useLocale();
  const now = useNow(1000);
  const [state, setState] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [page, setPage] = useState(1);
  const [classifying, setClassifying] = useState<MachineEvent | null>(null);

  const filters: EventFilters = {
    state: isMachineState(state) ? state : undefined,
    from: fromDay ? parseDayKey(fromDay, timeZone).toISOString() : undefined,
    to: toDay ? addDays(parseDayKey(toDay, timeZone), 1).toISOString() : undefined,
    page,
    page_size: 20,
  };

  const query = useQuery({
    queryKey: queryKeys.machines.events(machineId, filters),
    queryFn: () => listEvents(machineId, filters),
    placeholderData: keepPreviousData,
  });

  function reasonLabel(event: MachineEvent): string {
    if (event.reason) return locale === 'en' ? event.reason.label_en : event.reason.label_es;
    if (event.reason_code) return t('alarmCode', { code: event.reason_code });
    return '—';
  }

  function durationOf(event: MachineEvent): string {
    const start = new Date(event.started_at).getTime();
    const end = event.ended_at ? new Date(event.ended_at).getTime() : now;
    return event.ended_at
      ? formatDuration((end - start) / 1000)
      : `${formatDuration((end - start) / 1000)} · ${t('ongoing')}`;
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-muted">
            {t('from')}
            <Input
              type="date"
              value={fromDay}
              max={toDay || undefined}
              onChange={(e) => {
                setFromDay(e.target.value);
                setPage(1);
              }}
              className="w-auto"
            />
          </label>
          <label className="flex items-center gap-1 text-sm text-muted">
            {t('to')}
            <Input
              type="date"
              value={toDay}
              min={fromDay || undefined}
              onChange={(e) => {
                setToDay(e.target.value);
                setPage(1);
              }}
              className="w-auto"
            />
          </label>
          <label>
            <span className="sr-only">{t('state')}</span>
            <Select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(1);
              }}
              className="w-auto"
            >
              <option value="">{t('allStates')}</option>
              {MACHINE_STATES.map((item) => (
                <option key={item} value={item}>
                  {ts(item)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <QueryState
        query={query}
        skeleton={
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        }
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState title={t('emptyTitle')} text={t('emptyText')} />}
      >
        {(data) => (
          <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60')}>
            <div className="overflow-x-auto panel">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">{t('started')}</th>
                    <th className="px-3 py-2 font-medium">{t('duration')}</th>
                    <th className="px-3 py-2 font-medium">{t('state')}</th>
                    <th className="px-3 py-2 font-medium">{t('reason')}</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">{t('comment')}</th>
                    {canEdit ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => (
                    <tr key={event.id} className="border-b border-line/60 align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDateTime(event.started_at, timeZone, locale)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" suppressHydrationWarning>
                        {durationOf(event)}
                      </td>
                      <td className="px-3 py-2">
                        <StateIndicator state={event.state} size="sm" />
                      </td>
                      <td className="px-3 py-2">
                        {reasonLabel(event)}
                        {event.classified_by ? (
                          <p className="text-xs text-muted">
                            {t('classifiedBy', { user: event.classified_by.username })}
                          </p>
                        ) : null}
                      </td>
                      <td className="hidden max-w-xs px-3 py-2 text-muted md:table-cell">
                        {event.comment ?? ''}
                      </td>
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          {event.state === 'DOWN' ? (
                            <Button variant="ghost" size="sm" onClick={() => setClassifying(event)}>
                              {t('classify')}
                            </Button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.has_prev || data.has_next ? (
              <nav aria-label={tp('label')} className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {tp('pageOf', {
                    page: data.page,
                    pages: Math.max(1, Math.ceil(data.total / data.page_size)),
                  })}
                </span>
                <div className="flex gap-2">
                  {data.has_prev ? (
                    <Button variant="secondary" size="sm" onClick={() => setPage(data.page - 1)}>
                      <IconChevronLeft className="size-4" />
                      {tp('previous')}
                    </Button>
                  ) : null}
                  {data.has_next ? (
                    <Button variant="secondary" size="sm" onClick={() => setPage(data.page + 1)}>
                      {tp('next')}
                      <IconChevronRight className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </div>
        )}
      </QueryState>

      {classifying ? (
        <ClassifyEventDialog
          key={classifying.id}
          event={classifying}
          onClose={() => setClassifying(null)}
        />
      ) : null}
    </section>
  );
}
