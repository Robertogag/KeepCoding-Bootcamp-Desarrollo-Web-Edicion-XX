'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Input, Select } from '@/components/form/Field';
import { Pagination } from '@/components/layout/Pagination';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { StateIndicator } from '@/components/status/StateIndicator';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/icons';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { listMachines } from '@/lib/api/machines';
import type { Machine, MachineFilters } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatPercent, formatSince } from '@/lib/format';
import { isMachineState, MACHINE_STATES } from '@/lib/machine-state';
import { queryKeys } from '@/lib/query/keys';
import { DeleteMachineButton } from './DeleteMachineButton';

const PAGE_SIZE = 20;

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function MachineTable() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('machines');
  const ts = useTranslations('machineState');
  const locale = useLocale();
  const now = useNow(1000);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('search') ?? '';
  const stateParam = searchParams.get('state');
  const state = isMachineState(stateParam) ? stateParam : undefined;
  const brand = searchParams.get('brand') ?? '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const hasFilters = Boolean(search || state || brand);

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function setFilter(key: 'search' | 'state' | 'brand', value: string) {
    replaceParams((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
    });
  }

  useEffect(() => {
    if (debouncedSearch !== search) setFilter('search', debouncedSearch);
    // La URL es la fuente de verdad; solo se sincroniza cuando el texto debounced cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: MachineFilters = {
    search: search || undefined,
    state,
    brand: brand || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const query = useQuery({
    queryKey: queryKeys.machines.list(plant.id, filters),
    queryFn: () => listMachines(plant.id, filters),
    placeholderData: keepPreviousData,
  });

  const brands = useQuery({
    queryKey: queryKeys.machines.brands(plant.id),
    queryFn: async () => {
      const all = await listMachines(plant.id, { page_size: 100 });
      return [...new Set(all.items.map((item) => item.brand).filter(Boolean))].sort();
    },
    staleTime: 5 * 60_000,
  });

  const hrefForPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 1) params.set('page', String(next));
    else params.delete('page');
    const value = params.toString();
    return value ? `${pathname}?${value}` : pathname;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        {canEdit ? (
          <Link
            href={`/app/plants/${plant.id}/machines/new`}
            className={buttonClasses('primary', 'sm')}
          >
            <IconPlus className="size-4" />
            {t('new')}
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">{t('search')}</span>
          <Input
            type="search"
            placeholder={t('search')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{t('state')}</span>
          <Select
            value={state ?? ''}
            onChange={(event) => setFilter('state', event.target.value)}
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
        <label>
          <span className="sr-only">{t('brand')}</span>
          <Select
            value={brand}
            onChange={(event) => setFilter('brand', event.target.value)}
            className="w-auto"
          >
            <option value="">{t('allBrands')}</option>
            {(brands.data ?? (brand ? [brand] : [])).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              replaceParams((params) => {
                params.delete('search');
                params.delete('state');
                params.delete('brand');
                params.delete('page');
              });
            }}
          >
            {t('clearFilters')}
          </Button>
        ) : null}
      </div>

      <QueryState
        query={query}
        skeleton={<TableSkeleton />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          hasFilters ? (
            <EmptyState title={t('noResultsTitle')} text={t('noResultsText')} />
          ) : (
            <EmptyState
              title={t('emptyTitle')}
              text={t('emptyText')}
              action={
                canEdit ? (
                  <Link
                    href={`/app/plants/${plant.id}/machines/new`}
                    className={buttonClasses('primary', 'sm')}
                  >
                    <IconPlus className="size-4" />
                    {t('new')}
                  </Link>
                ) : undefined
              }
            />
          )
        }
      >
        {(data) => (
          <div className={cn('space-y-4', query.isPlaceholderData && 'opacity-60')}>
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">{t('columns.name')}</th>
                  <th className="py-2 pr-3 font-medium">{t('columns.state')}</th>
                  <th className="py-2 pr-3 font-medium">{t('columns.since')}</th>
                  <th className="py-2 pr-3 font-medium">{t('columns.connection')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('columns.oee')}</th>
                  {canEdit ? (
                    <th className="py-2 text-right font-medium">{t('columns.actions')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.items.map((machine) => (
                  <MachineRow
                    key={machine.id}
                    machine={machine}
                    now={now}
                    locale={locale}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>

            <ul className="space-y-2 md:hidden">
              {data.items.map((machine) => (
                <li key={machine.id} className="panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/app/plants/${plant.id}/machines/${machine.id}`}
                        className="font-medium hover:underline"
                      >
                        {machine.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {[machine.brand, machine.model].filter(Boolean).join(' ')}
                      </p>
                    </div>
                    <StateIndicator state={machine.snapshot.state} size="sm" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted" suppressHydrationWarning>
                      {formatSince(machine.snapshot.since, now)}
                    </span>
                    <span className="font-medium">
                      {formatPercent(machine.snapshot.oee_today.oee, locale)}
                    </span>
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex justify-end gap-1">
                      <Link
                        href={`/app/plants/${plant.id}/machines/${machine.id}/edit`}
                        className={buttonClasses('ghost', 'sm')}
                      >
                        {t('edit')}
                      </Link>
                      <DeleteMachineButton machine={machine} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <Pagination data={data} hrefFor={hrefForPage} />
          </div>
        )}
      </QueryState>
    </div>
  );
}

function MachineRow({
  machine,
  now,
  locale,
  canEdit,
}: {
  machine: Machine;
  now: number;
  locale: string;
  canEdit: boolean;
}) {
  const t = useTranslations('machines');
  return (
    <tr className="border-b border-line/60">
      <td className="py-2 pr-3">
        <Link
          href={`/app/plants/${machine.plant_id}/machines/${machine.id}`}
          className="font-medium hover:underline"
        >
          {machine.name}
        </Link>
        <p className="text-xs text-muted">
          {[machine.brand, machine.model].filter(Boolean).join(' ')}
        </p>
      </td>
      <td className="py-2 pr-3">
        <StateIndicator state={machine.snapshot.state} size="sm" />
        {!machine.is_active ? <p className="text-xs text-muted">{t('inactive')}</p> : null}
      </td>
      <td className="py-2 pr-3" suppressHydrationWarning>
        {formatSince(machine.snapshot.since, now)}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-muted">
        {machine.host}:{machine.port} · {machine.unit_id}
      </td>
      <td className="py-2 pr-3 text-right font-medium">
        {formatPercent(machine.snapshot.oee_today.oee, locale)}
      </td>
      {canEdit ? (
        <td className="py-2 text-right">
          <div className="inline-flex gap-1">
            <Link
              href={`/app/plants/${machine.plant_id}/machines/${machine.id}/edit`}
              className={buttonClasses('ghost', 'sm')}
            >
              {t('edit')}
            </Link>
            <DeleteMachineButton machine={machine} />
          </div>
        </td>
      ) : null}
    </tr>
  );
}
