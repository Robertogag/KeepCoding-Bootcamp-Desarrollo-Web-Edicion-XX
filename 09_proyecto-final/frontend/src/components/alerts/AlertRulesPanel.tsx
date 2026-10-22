'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconPlus } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { deleteAlertRule, listAlertRules } from '@/lib/api/alerts';
import { listMachines } from '@/lib/api/machines';
import type { AlertRule } from '@/lib/api/types';
import { formatDuration, formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { AlertRuleDialog } from './AlertRuleDialog';

const ALL_MACHINES = { page_size: 100 };

export function AlertRulesPanel() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('alerts');
  const tc = useTranslations('common');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AlertRule | null>(null);
  const [deleting, setDeleting] = useState<AlertRule | null>(null);

  const rules = useQuery({
    queryKey: queryKeys.plants.alertRules(plant.id),
    queryFn: () => listAlertRules(plant.id),
  });
  const machines = useQuery({
    queryKey: queryKeys.machines.list(plant.id, ALL_MACHINES),
    queryFn: () => listMachines(plant.id, ALL_MACHINES),
  });
  const machineName = (id: number | null) =>
    id === null
      ? t('allMachines')
      : (machines.data?.items.find((item) => item.id === id)?.name ?? `#${id}`);

  const removal = useMutation({
    mutationFn: (rule: AlertRule) => deleteAlertRule(rule.id),
    onSuccess: async () => {
      setDeleting(null);
      toast({ title: t('delete.done'), variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.alertRules(plant.id) });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setCreating(true)}>
            <IconPlus className="size-4" />
            {t('new')}
          </Button>
        ) : null}
      </div>

      <QueryState
        query={rules}
        skeleton={
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        }
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            title={t('emptyTitle')}
            text={t('emptyText')}
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setCreating(true)}>
                  <IconPlus className="size-4" />
                  {t('new')}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <ul className="divide-y divide-line panel">
            {data.items.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t(`types.${rule.type}`)}
                    {rule.type === 'OEE_BELOW' ? ` · ${formatPercent(rule.threshold, locale)}` : ''}
                  </p>
                  <p className="text-sm text-muted">
                    {machineName(rule.machine_id)} · {formatDuration(rule.duration_s)} ·{' '}
                    {rule.is_active ? t('active') : t('inactive')}
                  </p>
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(rule)}>
                      {tc('edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(rule)}>
                      {tc('delete')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {creating ? (
        <AlertRuleDialog
          plantId={plant.id}
          machines={machines.data?.items ?? []}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing ? (
        <AlertRuleDialog
          key={editing.id}
          plantId={plant.id}
          machines={machines.data?.items ?? []}
          rule={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => !removal.isPending && setDeleting(null)}
        onConfirm={() => deleting && removal.mutate(deleting)}
        title={t('delete.title')}
        confirmLabel={t('delete.confirm')}
        pending={removal.isPending}
        danger
      >
        <p>{t('delete.text')}</p>
      </ConfirmDialog>
    </div>
  );
}
