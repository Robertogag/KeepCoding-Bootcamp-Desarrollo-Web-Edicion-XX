'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/state/EmptyState';
import { useState } from 'react';
import { Input } from '@/components/form/Field';
import { useErrorMessage } from '@/components/state/errorMessage';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { deletePlant } from '@/lib/api/plants';
import { queryKeys } from '@/lib/query/keys';
import { usePlant } from './PlantContext';
import { PlantForm } from './PlantForm';

export function PlantSettings() {
  const { plant, isOwner } = usePlant();
  const t = useTranslations('settings');
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const removal = useMutation({
    mutationFn: () => deletePlant(plant.id),
    onSuccess: async () => {
      toast({ title: t('deleted'), variant: 'success' });
      queryClient.removeQueries({ queryKey: queryKeys.plants.detail(plant.id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.all });
      router.replace('/app');
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  // Quien no es propietario llega aquí solo por URL: aviso claro en vez de un área vacía.
  if (!isOwner) return <EmptyState title={t('ownerOnlyTitle')} text={t('ownerOnlyText')} />;

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <div className="mt-4">
          <PlantForm plant={plant} />
        </div>
      </section>

      <section className="rounded-lg border border-down/40 bg-panel p-5">
        <h2 className="text-lg font-semibold">{t('deleteTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('deleteText')}</p>
        <div className="mt-4">
          <Button variant="danger" onClick={() => setOpen(true)}>
            {t('deleteButton')}
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (removal.isPending) return;
          setOpen(false);
          setConfirmation('');
        }}
        onConfirm={() => removal.mutate()}
        title={t('confirmTitle', { name: plant.name })}
        confirmLabel={t('confirm')}
        pending={removal.isPending}
        disabled={confirmation.trim() !== plant.name}
        danger
      >
        <p>{t('deleteText')}</p>
        <label className="block text-fg">
          <span className="text-sm">{t('typeName', { name: plant.name })}</span>
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}
