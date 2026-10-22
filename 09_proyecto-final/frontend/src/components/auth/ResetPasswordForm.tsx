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
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { resetPassword } from '@/lib/api/auth';
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validation/auth';

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations('auth.reset');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const schema = useMemo(() => resetPasswordSchema(tv), [tv]);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ResetPasswordInput) => resetPassword(token ?? '', values.password),
    onError: (error) =>
      setAlert(applyApiError(error, form, describe, { new_password: 'password' })),
  });
  const { errors } = form.formState;

  if (!token) {
    return (
      <div className="space-y-4">
        <FormAlert message={t('missingToken')} />
        <Link href="/forgot-password" className={buttonClasses('secondary', 'sm')}>
          {t('request')}
        </Link>
      </div>
    );
  }

  if (mutation.isSuccess) {
    return (
      <div role="status" className="space-y-4">
        <p className="font-medium">{t('doneTitle')}</p>
        <p className="text-sm text-muted">{t('doneText')}</p>
        <Link href="/login" className={buttonClasses('primary', 'sm')}>
          {t('login')}
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        mutation.mutate(values);
      })}
    >
      <FormAlert message={alert} />
      <Field label={t('password')} htmlFor="reset-password" error={errors.password?.message}>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          aria-describedby={describedBy('reset-password', errors.password?.message)}
          {...form.register('password')}
        />
      </Field>
      <Field label={t('confirm')} htmlFor="reset-confirm" error={errors.confirm?.message}>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirm}
          aria-describedby={describedBy('reset-confirm', errors.confirm?.message)}
          {...form.register('confirm')}
        />
      </Field>
      <div className="flex justify-end">
        <PendingButton type="submit" pending={mutation.isPending}>
          {t('submit')}
        </PendingButton>
      </div>
    </form>
  );
}
