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
import { forgotPassword } from '@/lib/api/auth';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation/auth';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgot');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const schema = useMemo(() => forgotPasswordSchema(tv), [tv]);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ForgotPasswordInput) => forgotPassword(values.email),
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  const { errors } = form.formState;

  if (mutation.isSuccess) {
    return (
      <div role="status" className="space-y-4">
        <p className="font-medium">{t('sentTitle')}</p>
        <p className="text-sm text-muted">{t('sentText')}</p>
        <Link href="/login" className={buttonClasses('secondary', 'sm')}>
          {t('back')}
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
      <p className="rounded-md border border-idle/50 bg-idle-soft px-3 py-2 text-xs text-fg">
        {t('demoNotice')}
      </p>
      <Field label={t('email')} htmlFor="forgot-email" error={errors.email?.message}>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          aria-describedby={describedBy('forgot-email', errors.email?.message)}
          {...form.register('email')}
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
