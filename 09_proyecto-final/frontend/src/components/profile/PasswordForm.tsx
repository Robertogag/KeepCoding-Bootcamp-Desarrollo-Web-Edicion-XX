'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { useToast } from '@/components/ui/Toast';
import { changePassword } from '@/lib/api/auth';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validation/auth';

export function PasswordForm() {
  const t = useTranslations('profile.password');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const schema = useMemo(() => changePasswordSchema(tv), [tv]);
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: '', password: '', confirm: '' },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordInput) =>
      changePassword(values.current_password, values.password),
    onSuccess: () => {
      form.reset();
      toast({ title: t('saved'), variant: 'success' });
    },
    onError: (error) =>
      setAlert(applyApiError(error, form, describe, { new_password: 'password' })),
  });

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <form
        noValidate
        className="mt-4 space-y-4"
        onSubmit={form.handleSubmit((values) => {
          setAlert(null);
          mutation.mutate(values);
        })}
      >
        <FormAlert message={alert} />
        <Field
          label={t('current')}
          htmlFor="password-current"
          error={errors.current_password?.message}
        >
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            invalid={!!errors.current_password}
            aria-describedby={describedBy('password-current', errors.current_password?.message)}
            {...form.register('current_password')}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('new')} htmlFor="password-new" error={errors.password?.message}>
            <Input
              id="password-new"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.password}
              aria-describedby={describedBy('password-new', errors.password?.message)}
              {...form.register('password')}
            />
          </Field>
          <Field label={t('confirm')} htmlFor="password-confirm" error={errors.confirm?.message}>
            <Input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.confirm}
              aria-describedby={describedBy('password-confirm', errors.confirm?.message)}
              {...form.register('confirm')}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <PendingButton type="submit" pending={mutation.isPending}>
            {t('save')}
          </PendingButton>
        </div>
      </form>
    </section>
  );
}
