'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCatalog } from '@/components/catalogs/useCatalog';
import { Checkbox, Select } from '@/components/form/Field';
import { Pager } from '@/components/layout/Pager';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconAlert, IconPlus } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/hooks/useNow';
import { Link } from '@/i18n/navigation';
import { closeLineDowntime, listLineDowntimes } from '@/lib/api/injection';
import { listDowntimeReasons } from '@/lib/api/oee';
import type { DowntimeFilters, LineDowntime } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE, formatDateTime, formatDuration } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { OpenDowntimeDialog } from './OpenDowntimeDialog';

const PAGE = 20;
const OPEN: DowntimeFilters = { open: true, page_size: 100 };

export function downtimeSeconds(item: LineDowntime, now: number): number {
  const start = new Date(item.started_at).getTime();
  const end = item.ended_at ? new Date(item.ended_at).getTime() : now;
  return Math.max(0, (end - start) / 1000);
}

export function LineDowntimesPanel() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('downtimes');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState<LineDowntime | null>(null);
  const [lineId, setLineId] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [page, setPage] = useState(1);

  const lines = useCatalog(plant.id, 'production-lines');
  const reasons = useQuery({
    queryKey: queryKeys.reasons,
    queryFn: listDowntimeReasons,
    staleTime: 10 * 60_000,
  });
  const open = useQuery({
    queryKey: queryKeys.injection.downtimes(plant.id, OPEN),
    queryFn: () => listLineDowntimes(plant.id, OPEN),
    refetchInterval: 30_000,
  });
  const filters: DowntimeFilters = {
    line_id: lineId ? Number(lineId) : undefined,
    open: onlyOpen ? true : undefined,
    page,
    page_size: PAGE,
  };
  const history = useQuery({
    queryKey: queryKeys.injection.downtimes(plant.id, filters),
    queryFn: () => listLineDowntimes(plant.id, filters),
    placeholderData: keepPreviousData,
  });
  const close = useMutation({
    mutationFn: (item: LineDowntime) => closeLineDowntime(item.id),
    onSuccess: async () => {
      setClosing(null);
      toast({ title: t('closed'), variant: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plants', plant.id, 'injection', 'downtimes'] }),
        queryClient.invalidateQueries({ queryKey: ['plants', plant.id, 'board'] }),
      ]);
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  const lineName = (id: number) => {
    const line = lines.data?.find((item) => item.id === id);
    return line ? `${line.code} · ${line.name}` : `#${id}`;
  };
  const reasonLabel = (code: string) => {
    const reason = reasons.data?.items.find((item) => item.code === code);
    return reason ? (locale === 'en' ? reason.label_en : reason.label_es) : code;
  };
  const hasLines = (lines.data ?? []).some((line) => line.is_active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setOpening(true)} disabled={!hasLines}>
            <IconPlus className="size-4" />
            {t('new')}
          </Button>
        ) : null}
      </div>
      {canEdit && lines.isSuccess && !hasLines ? (
        <p className="text-sm text-muted">
          <Link href={`/app/plants/${plant.id}/catalogs`} className="underline hover:text-fg">
            {t('noLines')}
          </Link>
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="eyebrow">{t('open')}</h3>
        <QueryState
          query={open}
          skeleton={<Skeleton className="h-24 w-full" />}
          isEmpty={(data) => data.items.length === 0}
          empty={<p className="text-sm text-muted">{t('noOpen')}</p>}
        >
          {(data) => (
            <ul className="grid gap-3 md:grid-cols-2">
              {data.items.map((item) => (
                <li key={item.id} className="panel relative overflow-hidden p-4 pl-5">
                  <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-down" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold">
                        <IconAlert className="size-4 shrink-0 text-down" />
                        <span className="truncate">{lineName(item.line_id)}</span>
                      </p>
                      <p className="mt-1 text-sm">
                        {reasonLabel(item.reason_code)}
                        <span className="text-muted">
                          {' · '}
                          {item.planned ? t('planned') : t('unplanned')}
                          {' · '}
                          {t('affected', { count: item.affected_machine_ids.length })}
                        </span>
                      </p>
                      {item.comment ? (
                        <p className="mt-1 text-sm text-muted">{item.comment}</p>
                      ) : null}
                    </div>
                    <p className="numeric shrink-0 text-right text-lg" suppressHydrationWarning>
                      {formatDuration(downtimeSeconds(item, now))}
                      <span className="block text-xs text-muted">
                        {formatDateTime(item.started_at, plant.timezone, locale)}
                      </span>
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="mt-3 flex justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setClosing(item)}>
                        {t('close')}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="eyebrow">{t('history')}</h3>
          <label>
            <span className="sr-only">{t('line')}</span>
            <Select
              value={lineId}
              onChange={(event) => {
                setLineId(event.target.value);
                setPage(1);
              }}
              className="h-9 w-auto"
            >
              <option value="">{t('allLines')}</option>
              {(lines.data ?? []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.code} · {line.name}
                </option>
              ))}
            </Select>
          </label>
          <Checkbox
            label={t('onlyOpen')}
            checked={onlyOpen}
            onChange={(event) => {
              setOnlyOpen(event.target.checked);
              setPage(1);
            }}
          />
        </div>
        <QueryState
          query={history}
          skeleton={<Skeleton className="h-40 w-full" />}
          isEmpty={(data) => data.items.length === 0}
          empty={<EmptyState title={t('emptyHistory')} />}
        >
          {(data) => (
            <div className={cn('space-y-3', history.isPlaceholderData && 'opacity-60')}>
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">{t('line')}</th>
                      <th className="px-3 py-2 font-medium">{t('reason')}</th>
                      <th className="px-3 py-2 font-medium">{t('started')}</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">{t('ended')}</th>
                      <th className="px-3 py-2 text-right font-medium">{t('duration')}</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">{t('comment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-b border-line/60 align-top">
                        <td className="px-3 py-2">{lineName(item.line_id)}</td>
                        <td className="px-3 py-2">
                          {reasonLabel(item.reason_code)}
                          <span className="block text-xs text-muted">
                            {item.planned ? t('planned') : t('unplanned')} ·{' '}
                            {t('affected', { count: item.affected_machine_ids.length })}
                          </span>
                        </td>
                        <td className="numeric px-3 py-2 whitespace-nowrap">
                          {formatDateTime(item.started_at, plant.timezone, locale)}
                        </td>
                        <td className="numeric hidden px-3 py-2 whitespace-nowrap md:table-cell">
                          {item.ended_at
                            ? formatDateTime(item.ended_at, plant.timezone, locale)
                            : EMPTY_VALUE}
                        </td>
                        <td
                          className="numeric px-3 py-2 text-right whitespace-nowrap"
                          suppressHydrationWarning
                        >
                          {formatDuration(downtimeSeconds(item, now))}
                          {item.ended_at ? '' : ` · ${t('ongoing')}`}
                        </td>
                        <td className="hidden max-w-xs px-3 py-2 text-muted md:table-cell">
                          {item.comment}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager data={data} onPage={setPage} />
            </div>
          )}
        </QueryState>
      </section>

      {opening ? (
        <OpenDowntimeDialog
          plantId={plant.id}
          lines={lines.data ?? []}
          onClose={() => setOpening(false)}
        />
      ) : null}
      <ConfirmDialog
        open={closing !== null}
        onClose={() => !close.isPending && setClosing(null)}
        onConfirm={() => closing && close.mutate(closing)}
        title={t('confirmCloseTitle', { line: closing ? lineName(closing.line_id) : EMPTY_VALUE })}
        confirmLabel={t('close')}
        pending={close.isPending}
      >
        <p>{t('confirmCloseText')}</p>
      </ConfirmDialog>
    </div>
  );
}
