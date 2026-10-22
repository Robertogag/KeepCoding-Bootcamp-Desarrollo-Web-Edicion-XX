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
import { Link, useRouter } from '@/i18n/navigation';
import { login } from '@/lib/api/auth';
import { safeNextPath } from '@/lib/auth/next';
import { setSession } from '@/lib/auth/session';
import { resetQueryClient } from '@/lib/query/provider';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth.login');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const router = useRouter();
  const schema = useMemo(() => loginSchema(tv), [tv]);
  const form = useForm<LoginInput>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '' },
  });
  const [alert, setAlert] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user, access_token }) => {
      setSession(user, access_token);
      resetQueryClient();
      router.replace(safeNextPath(next), { locale: user.language });
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  const { errors } = form.formState;

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
      <Field label={t('username')} htmlFor="login-username" error={errors.username?.message}>
        <Input
          id="login-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          invalid={!!errors.username}
          aria-describedby={describedBy('login-username', errors.username?.message)}
          {...form.register('username')}
        />
      </Field>
      <Field label={t('password')} htmlFor="login-password" error={errors.password?.message}>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          aria-describedby={describedBy('login-password', errors.password?.message)}
          {...form.register('password')}
        />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/forgot-password"
          className="text-sm text-muted underline-offset-2 hover:underline"
        >
          {t('forgot')}
        </Link>
        <PendingButton type="submit" pending={mutation.isPending}>
          {t('submit')}
        </PendingButton>
      </div>
    </form>
  );
}
