'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { useAvailability, type AvailabilityStatus } from '@/hooks/useAvailability';
import { useRouter } from '@/i18n/navigation';
import { routing, type AppLocale } from '@/i18n/routing';
import { register as registerRequest } from '@/lib/api/auth';
import { setSession } from '@/lib/auth/session';
import { cn } from '@/lib/cn';
import { resetQueryClient } from '@/lib/query/provider';
import { registerSchema, USERNAME_PATTERN, type RegisterInput } from '@/lib/validation/auth';

const statusClasses: Record<AvailabilityStatus, string> = {
  idle: '',
  checking: 'text-muted',
  available: 'text-running',
  taken: 'text-down',
};

export function AvailabilityHint({
  status,
  fallback,
}: {
  status: AvailabilityStatus;
  fallback?: string;
}) {
  const t = useTranslations('auth.availability');
  if (status === 'idle') return fallback ? <>{fallback}</> : null;
  return (
    <span className={cn('font-medium', statusClasses[status])} aria-live="polite">
      {t(status)}
    </span>
  );
}

export function RegisterForm() {
  const t = useTranslations('auth.register');
  const tv = useTranslations('validation');
  const tl = useTranslations('locale');
  const locale = useLocale() as AppLocale;
  const describe = useErrorMessage();
  const router = useRouter();
  const schema = useMemo(() => registerSchema(tv), [tv]);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { username: '', email: '', full_name: '', password: '', language: locale },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors } = form.formState;

  const username = useWatch({ control: form.control, name: 'username' });
  const email = useWatch({ control: form.control, name: 'email' });
  const usernameStatus = useAvailability({
    field: 'username',
    value: username,
    valid: USERNAME_PATTERN.test(username),
  });
  const emailStatus = useAvailability({
    field: 'email',
    value: email,
    valid: !errors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  });

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: ({ user, access_token }) => {
      setSession(user, access_token);
      resetQueryClient();
      router.replace('/app', { locale: user.language });
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

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
      <Field
        label={t('username')}
        htmlFor="register-username"
        error={errors.username?.message}
        hint={<AvailabilityHint status={usernameStatus} fallback={t('usernameHint')} />}
      >
        <Input
          id="register-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          invalid={!!errors.username}
          aria-describedby={describedBy('register-username', errors.username?.message, true)}
          {...form.register('username')}
        />
      </Field>
      <Field
        label={t('email')}
        htmlFor="register-email"
        error={errors.email?.message}
        hint={<AvailabilityHint status={emailStatus} />}
      >
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          invalid={!!errors.email}
          aria-describedby={describedBy(
            'register-email',
            errors.email?.message,
            emailStatus !== 'idle',
          )}
          {...form.register('email')}
        />
      </Field>
      <Field label={t('fullName')} htmlFor="register-full-name" error={errors.full_name?.message}>
        <Input
          id="register-full-name"
          autoComplete="name"
          invalid={!!errors.full_name}
          aria-describedby={describedBy('register-full-name', errors.full_name?.message)}
          {...form.register('full_name')}
        />
      </Field>
      <Field
        label={t('password')}
        htmlFor="register-password"
        error={errors.password?.message}
        hint={t('passwordHint')}
      >
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          aria-describedby={describedBy('register-password', errors.password?.message, true)}
          {...form.register('password')}
        />
      </Field>
      <Field label={t('language')} htmlFor="register-language" error={errors.language?.message}>
        <Select id="register-language" invalid={!!errors.language} {...form.register('language')}>
          {routing.locales.map((item) => (
            <option key={item} value={item}>
              {tl(item)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end">
        <PendingButton type="submit" pending={mutation.isPending}>
          {t('submit')}
        </PendingButton>
      </div>
    </form>
  );
}
