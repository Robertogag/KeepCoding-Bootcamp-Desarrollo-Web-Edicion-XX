'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCatalog } from '@/components/catalogs/useCatalog';
import { StartRunDialog } from '@/components/production/ProductionDialogs';
import { TraceabilityDialog } from '@/components/production/TraceabilityDialog';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { SinceLabel } from '@/components/status/SinceLabel';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { endRun, getProductionContext, listOrders } from '@/lib/api/injection';
import type { Machine } from '@/lib/api/types';
import { EMPTY_VALUE, formatDecimal } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

function Spec({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={numeric ? 'numeric truncate text-sm' : 'truncate text-sm'}>{value}</dd>
    </div>
  );
}

export function ProductionContextPanel({
  machine,
  plantId,
  timeZone,
  canEdit,
}: {
  machine: Machine;
  plantId: number;
  timeZone: string;
  canEdit: boolean;
}) {
  const t = useTranslations('context');
  const tp = useTranslations('production');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [tracing, setTracing] = useState(false);
  const query = useQuery({
    queryKey: queryKeys.machines.context(machine.id),
    queryFn: () => getProductionContext(machine.id),
    refetchInterval: 30_000,
  });
  const recipes = useCatalog(plantId, 'injection-recipes');
  const molds = useCatalog(plantId, 'molds');
  const planned = useQuery({
    queryKey: queryKeys.injection.orders(plantId, { status: 'planned', page_size: 100 }),
    queryFn: () => listOrders(plantId, { status: 'planned', page_size: 100 }),
    enabled: starting,
  });
  const close = useMutation({
    mutationFn: (runId: number) => endRun(runId),
    onSuccess: async () => {
      setEnding(false);
      toast({ title: tp('runEnded'), variant: 'success' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.machines.context(machine.id) }),
        queryClient.invalidateQueries({ queryKey: ['plants', plantId, 'injection'] }),
      ]);
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  return (
    <section aria-labelledby="machine-context" className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="machine-context" className="eyebrow">
          {t('title')}
        </h3>
        <QueryState query={query} skeleton={null}>
          {(data) =>
            data.run ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setTracing(true)}>
                  {tp('traceability')}
                </Button>
                {canEdit ? (
                  <Button variant="secondary" size="sm" onClick={() => setEnding(true)}>
                    {tp('endRun')}
                  </Button>
                ) : null}
              </div>
            ) : canEdit ? (
              <Button size="sm" onClick={() => setStarting(true)}>
                {tp('startRun')}
              </Button>
            ) : null
          }
        </QueryState>
      </div>
      <QueryState query={query} skeleton={<Skeleton className="mt-3 h-20 w-full" />}>
        {(data) => {
          const run = data.run;
          if (!run) {
            return (
              <div className="mt-3">
                <p className="font-medium">{t('none')}</p>
                <p className="mt-1 text-sm text-muted">{t('noneText')}</p>
              </div>
            );
          }
          const { context } = run;
          return (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Spec
                label={t('order')}
                value={`${context.recipe_code} · #${run.order_id}`}
                numeric
              />
              <Spec label={t('product')} value={context.product_name || context.product_code} />
              <Spec label={t('mold')} value={context.mold_name ?? context.mold_code} />
              <Spec label={t('resin')} value={context.resin_name ?? context.resin_code} />
              <Spec
                label={t('cavities')}
                value={t('cavitiesValue', {
                  active: run.active_cavities,
                  nominal: run.nominal_cavities,
                })}
                numeric
              />
              <Spec
                label={t('cyclePerShot')}
                value={`${formatDecimal(run.ideal_cycle_s, locale)} s`}
                numeric
              />
              <Spec
                label={t('perPiece')}
                value={
                  data.ideal_seconds_per_piece === null
                    ? EMPTY_VALUE
                    : `${formatDecimal(data.ideal_seconds_per_piece, locale)} s`
                }
                numeric
              />
              <div className="min-w-0">
                <dt className="eyebrow">{t('since')}</dt>
                <dd className="numeric truncate text-sm">
                  <SinceLabel since={run.started_at} />
                </dd>
              </div>
            </dl>
          );
        }}
      </QueryState>

      {starting ? (
        <StartRunDialog
          plantId={plantId}
          machines={[machine]}
          orders={planned.data?.items ?? []}
          recipes={recipes.data ?? []}
          molds={molds.data ?? []}
          openRuns={[]}
          initialMachineId={machine.id}
          onClose={() => setStarting(false)}
        />
      ) : null}
      {tracing && query.data?.run ? (
        <TraceabilityDialog
          runId={query.data.run.id}
          plantId={plantId}
          timeZone={timeZone}
          canEdit={canEdit}
          machineName={machine.name}
          onClose={() => setTracing(false)}
        />
      ) : null}
      <ConfirmDialog
        open={ending}
        onClose={() => !close.isPending && setEnding(false)}
        onConfirm={() => query.data?.run && close.mutate(query.data.run.id)}
        title={tp('confirmEndTitle', { machine: machine.name })}
        confirmLabel={tp('endRun')}
        pending={close.isPending}
      >
        <p>{tp('confirmEndText')}</p>
      </ConfirmDialog>
    </section>
  );
}
