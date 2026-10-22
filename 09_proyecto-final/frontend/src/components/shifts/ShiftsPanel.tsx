'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { deleteShift, listShifts } from '@/lib/api/shifts';
import type { Shift } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { ShiftDialog } from './ShiftDialog';

export function ShiftsPanel() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('shifts');
  const tc = useTranslations('common');
  const td = useTranslations('days');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Shift | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Shift | null>(null);

  const query = useQuery({
    queryKey: queryKeys.plants.shifts(plant.id),
    queryFn: () => listShifts(plant.id),
  });

  const removal = useMutation({
    mutationFn: (shift: Shift) => deleteShift(shift.id),
    onSuccess: async () => {
      setDeleting(null);
      toast({ title: t('delete.done'), variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.shifts(plant.id) });
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
        query={query}
        skeleton={
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
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
            {data.items.map((shift) => (
              <li key={shift.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{shift.name}</p>
                  <p className="text-sm text-muted">
                    {shift.start_time} – {shift.end_time}
                    {shift.end_time <= shift.start_time ? ` (${t('crossesMidnight')})` : ''}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  {shift.days_of_week.map((day) => td(String(day))).join(' · ')}
                </p>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(shift)}>
                      {tc('edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(shift)}>
                      {tc('delete')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </QueryState>

      {creating ? <ShiftDialog open onClose={() => setCreating(false)} plantId={plant.id} /> : null}
      {editing ? (
        <ShiftDialog
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          plantId={plant.id}
          shift={editing}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => !removal.isPending && setDeleting(null)}
        onConfirm={() => deleting && removal.mutate(deleting)}
        title={t('delete.title', { name: deleting?.name ?? '' })}
        confirmLabel={t('delete.confirm')}
        pending={removal.isPending}
        danger
      >
        <p>{t('delete.text')}</p>
      </ConfirmDialog>
    </div>
  );
}
