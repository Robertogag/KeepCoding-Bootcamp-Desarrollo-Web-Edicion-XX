'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { deleteMe } from '@/lib/api/auth';
import { listSoleOwnedPlants } from '@/lib/api/plants';
import { clearSession } from '@/lib/auth/session';
import { queryKeys } from '@/lib/query/keys';
import { resetQueryClient } from '@/lib/query/provider';
import { deleteAccountSchema, type DeleteAccountInput } from '@/lib/validation/auth';

export function DeleteAccount() {
  const t = useTranslations('profile.delete');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const schema = useMemo(() => deleteAccountSchema(tv), [tv]);
  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });
  const { errors } = form.formState;

  const soleOwned = useQuery({
    queryKey: queryKeys.soleOwnedPlants,
    queryFn: listSoleOwnedPlants,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (values: DeleteAccountInput) => deleteMe(values.password),
    onSuccess: () => {
      clearSession('signout');
      resetQueryClient();
      toast({ title: t('done'), variant: 'success' });
      router.replace('/');
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  function close() {
    if (mutation.isPending) return;
    setOpen(false);
    setAlert(null);
    form.reset();
  }

  return (
    <section className="rounded-lg border border-down/40 bg-panel p-5">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('text')}</p>
      <div className="mt-4">
        <Button variant="danger" onClick={() => setOpen(true)}>
          {t('button')}
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onClose={close}
        onConfirm={form.handleSubmit((values) => {
          setAlert(null);
          mutation.mutate(values);
        })}
        title={t('confirmTitle')}
        confirmLabel={t('confirm')}
        pending={mutation.isPending}
        danger
      >
        <p>{t('text')}</p>
        {soleOwned.data && soleOwned.data.length > 0 ? (
          <div className="rounded-md border border-down/40 bg-down-soft/60 p-3 text-fg">
            <p>{t('soleOwner')}</p>
            <ul className="mt-1 list-disc pl-5">
              {soleOwned.data.map((plant) => (
                <li key={plant.id}>{plant.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <FormAlert message={alert} />
        <Field
          label={t('password')}
          htmlFor="delete-password"
          error={errors.password?.message}
          className="text-fg"
        >
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            aria-describedby={describedBy('delete-password', errors.password?.message)}
            {...form.register('password')}
          />
        </Field>
      </ConfirmDialog>
    </section>
  );
}
