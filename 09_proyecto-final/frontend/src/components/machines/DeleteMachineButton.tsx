'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorMessage } from '@/components/state/errorMessage';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { deleteMachine } from '@/lib/api/machines';
import type { Machine } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';

interface DeleteMachineButtonProps {
  machine: Pick<Machine, 'id' | 'name' | 'plant_id'>;
  redirectTo?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function DeleteMachineButton({
  machine,
  redirectTo,
  variant = 'ghost',
  size = 'sm',
}: DeleteMachineButtonProps) {
  const t = useTranslations('machines.delete');
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteMachine(machine.id),
    onSuccess: async () => {
      setOpen(false);
      toast({ title: t('done'), variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.all });
      if (redirectTo) router.replace(redirectTo);
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {t('button')}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => !mutation.isPending && setOpen(false)}
        onConfirm={() => mutation.mutate()}
        title={t('title', { name: machine.name })}
        confirmLabel={t('confirm')}
        pending={mutation.isPending}
        danger
      >
        <p>{t('text')}</p>
      </ConfirmDialog>
    </>
  );
}
