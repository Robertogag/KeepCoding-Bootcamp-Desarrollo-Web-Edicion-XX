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
import { IconPlus } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/hooks/useNow';
import { endRun, listOrders, listRuns, updateOrderStatus } from '@/lib/api/injection';
import { listMachines } from '@/lib/api/machines';
import type {
  OrderFilters,
  OrderStatus,
  ProductionOrder,
  ProductionRun,
  RunFilters,
} from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE, formatDateTime, formatDuration, formatInteger } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { OrderDialog, StartRunDialog } from './ProductionDialogs';
import { runDuration, TraceabilityDialog } from './TraceabilityDialog';

const STATUSES: OrderStatus[] = ['planned', 'running', 'completed', 'cancelled'];
const PAGE = 20;
const ALL_MACHINES = { page_size: 100 };
const OPEN_RUNS: RunFilters = { open: true, page_size: 100 };

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function OrdersSection() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('production');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const recipes = useCatalog(plant.id, 'injection-recipes');
  const filters: OrderFilters = {
    status: STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : undefined,
    page,
    page_size: PAGE,
  };
  const query = useQuery({
    queryKey: queryKeys.injection.orders(plant.id, filters),
    queryFn: () => listOrders(plant.id, filters),
    placeholderData: keepPreviousData,
  });
  const change = useMutation({
    mutationFn: ({
      order,
      next,
    }: {
      order: ProductionOrder;
      next: Exclude<OrderStatus, 'running'>;
    }) => updateOrderStatus(order.id, next),
    onSuccess: async () => {
      toast({ title: t('orderUpdated'), variant: 'success' });
      await queryClient.invalidateQueries({
        queryKey: ['plants', plant.id, 'injection', 'orders'],
      });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });
  const recipeLabel = (id: number) => {
    const recipe = recipes.data?.find((item) => item.id === id);
    return recipe ? `${recipe.code} · ${recipe.name}` : `#${id}`;
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">{t('orders')}</h3>
          <label>
            <span className="sr-only">{t('status.planned')}</span>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-9 w-auto"
            >
              <option value="">{t('allStatuses')}</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>
                  {t(`status.${item}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <IconPlus className="size-4" />
            {t('newOrder')}
          </Button>
        ) : null}
      </div>
      <QueryState
        query={query}
        skeleton={<TableSkeleton />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState title={t('emptyOrders')} text={canEdit ? t('emptyOrdersText') : undefined} />
        }
      >
        {(data) => (
          <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60')}>
            <div className="panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">{t('orderCode')}</th>
                    <th className="px-3 py-2 font-medium">{t('recipe')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('target')}</th>
                    <th className="px-3 py-2 font-medium">{t('statusLabel')}</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">{t('started')}</th>
                    {canEdit ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((order) => (
                    <tr key={order.id} className="border-b border-line/60">
                      <td className="numeric px-3 py-2">{order.code}</td>
                      <td className="px-3 py-2">{recipeLabel(order.recipe_id)}</td>
                      <td className="numeric px-3 py-2 text-right">
                        {formatInteger(order.target_pieces, locale)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'font-medium',
                            order.status === 'running' && 'text-running',
                            order.status === 'cancelled' && 'text-muted',
                          )}
                        >
                          {t(`status.${order.status}`)}
                        </span>
                      </td>
                      <td className="numeric hidden px-3 py-2 text-xs text-muted md:table-cell">
                        {formatDateTime(order.created_at, plant.timezone, locale)}
                      </td>
                      {canEdit ? (
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {order.status === 'planned' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={change.isPending}
                                onClick={() => change.mutate({ order, next: 'completed' })}
                              >
                                {t('complete')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={change.isPending}
                                onClick={() => change.mutate({ order, next: 'cancelled' })}
                              >
                                {t('cancelOrder')}
                              </Button>
                            </>
                          ) : order.status === 'running' ? null : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={change.isPending}
                              onClick={() => change.mutate({ order, next: 'planned' })}
                            >
                              {t('reopen')}
                            </Button>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={data} onPage={setPage} />
          </div>
        )}
      </QueryState>
      {creating ? (
        <OrderDialog
          plantId={plant.id}
          recipes={recipes.data ?? []}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </section>
  );
}

function RunsSection() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('production');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [machineId, setMachineId] = useState('');
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState<ProductionRun | null>(null);
  const [tracing, setTracing] = useState<ProductionRun | null>(null);

  const machines = useQuery({
    queryKey: queryKeys.machines.list(plant.id, ALL_MACHINES),
    queryFn: () => listMachines(plant.id, ALL_MACHINES),
  });
  const recipes = useCatalog(plant.id, 'injection-recipes');
  const molds = useCatalog(plant.id, 'molds');
  const plannedOrders = useQuery({
    queryKey: queryKeys.injection.orders(plant.id, { status: 'planned', page_size: 100 }),
    queryFn: () => listOrders(plant.id, { status: 'planned', page_size: 100 }),
    enabled: starting,
  });
  const openRuns = useQuery({
    queryKey: queryKeys.injection.runs(plant.id, OPEN_RUNS),
    queryFn: () => listRuns(plant.id, OPEN_RUNS),
    enabled: starting,
  });
  const filters: RunFilters = {
    open: onlyOpen ? true : undefined,
    machine_id: machineId ? Number(machineId) : undefined,
    page,
    page_size: PAGE,
  };
  const query = useQuery({
    queryKey: queryKeys.injection.runs(plant.id, filters),
    queryFn: () => listRuns(plant.id, filters),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const close = useMutation({
    mutationFn: (run: ProductionRun) => endRun(run.id),
    onSuccess: async (run) => {
      setEnding(null);
      toast({ title: t('runEnded'), variant: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plants', plant.id, 'injection'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.machines.context(run.machine_id) }),
      ]);
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });
  const machineName = (id: number) =>
    machines.data?.items.find((machine) => machine.id === id)?.name ?? `#${id}`;
  const orderCode = (run: ProductionRun) => `${run.context.recipe_code} · #${run.order_id}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold">{t('runs')}</h3>
          <Checkbox
            label={t('onlyOpen')}
            checked={onlyOpen}
            onChange={(event) => {
              setOnlyOpen(event.target.checked);
              setPage(1);
            }}
          />
          <label>
            <span className="sr-only">{t('machine')}</span>
            <Select
              value={machineId}
              onChange={(event) => {
                setMachineId(event.target.value);
                setPage(1);
              }}
              className="h-9 w-auto"
            >
              <option value="">{t('allMachines')}</option>
              {(machines.data?.items ?? []).map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setStarting(true)}>
            <IconPlus className="size-4" />
            {t('startRun')}
          </Button>
        ) : null}
      </div>
      <QueryState
        query={query}
        skeleton={<TableSkeleton />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState title={t('emptyRuns')} text={canEdit ? t('emptyRunsText') : undefined} />
        }
      >
        {(data) => (
          <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60')}>
            <div className="panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">{t('machine')}</th>
                    <th className="px-3 py-2 font-medium">{t('product')}</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">{t('mold')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('cavities')}</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">{t('started')}</th>
                    <th className="px-3 py-2 font-medium">{t('duration')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((run) => (
                    <tr key={run.id} className="border-b border-line/60 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{machineName(run.machine_id)}</p>
                        <p className="numeric text-xs text-muted">{orderCode(run)}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p>{run.context.product_name || run.context.product_code}</p>
                        <p className="text-xs text-muted">
                          {run.context.resin_name ?? run.context.resin_code}
                          {run.context.line_code
                            ? ` · ${run.context.line_name ?? run.context.line_code}`
                            : ''}
                        </p>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        {run.context.mold_name ?? run.context.mold_code}
                      </td>
                      <td className="numeric px-3 py-2 text-right">
                        {run.active_cavities}/{run.nominal_cavities}
                      </td>
                      <td className="numeric hidden px-3 py-2 text-xs text-muted md:table-cell">
                        {formatDateTime(run.started_at, plant.timezone, locale)}
                      </td>
                      <td className="numeric px-3 py-2" suppressHydrationWarning>
                        {formatDuration(runDuration(run, now))}
                        <span
                          className={cn(
                            'block text-xs',
                            run.ended_at ? 'text-muted' : 'text-running',
                          )}
                        >
                          {run.ended_at ? t('closed') : t('open')}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => setTracing(run)}>
                          {t('traceability')}
                        </Button>
                        {canEdit && run.ended_at === null ? (
                          <Button variant="ghost" size="sm" onClick={() => setEnding(run)}>
                            {t('endRun')}
                          </Button>
                        ) : null}
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

      {starting ? (
        <StartRunDialog
          plantId={plant.id}
          machines={machines.data?.items ?? []}
          orders={plannedOrders.data?.items ?? []}
          recipes={recipes.data ?? []}
          molds={molds.data ?? []}
          openRuns={openRuns.data?.items ?? []}
          onClose={() => setStarting(false)}
        />
      ) : null}
      {tracing ? (
        <TraceabilityDialog
          runId={tracing.id}
          plantId={plant.id}
          timeZone={plant.timezone}
          canEdit={canEdit}
          machineName={machineName(tracing.machine_id)}
          onClose={() => setTracing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={ending !== null}
        onClose={() => !close.isPending && setEnding(null)}
        onConfirm={() => ending && close.mutate(ending)}
        title={t('confirmEndTitle', {
          machine: ending ? machineName(ending.machine_id) : EMPTY_VALUE,
        })}
        confirmLabel={t('endRun')}
        pending={close.isPending}
      >
        <p>{t('confirmEndText')}</p>
      </ConfirmDialog>
    </section>
  );
}

export function ProductionPanel() {
  const t = useTranslations('production');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{t('subtitle')}</p>
      </div>
      <RunsSection />
      <OrdersSection />
    </div>
  );
}
