'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AvailabilityHint } from '@/components/auth/RegisterForm';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { useToast } from '@/components/ui/Toast';
import { useAvailability } from '@/hooks/useAvailability';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { updateMe } from '@/lib/api/auth';
import type { User } from '@/lib/api/types';
import { setSessionUser } from '@/lib/auth/session';
import { profileSchema, USERNAME_PATTERN, type ProfileInput } from '@/lib/validation/auth';

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations('profile.data');
  const tv = useTranslations('validation');
  const tl = useTranslations('locale');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const schema = useMemo(() => profileSchema(tv), [tv]);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    values: {
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      language: user.language,
    },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors, isDirty } = form.formState;

  const username = useWatch({ control: form.control, name: 'username' });
  const email = useWatch({ control: form.control, name: 'email' });
  const usernameStatus = useAvailability({
    field: 'username',
    value: username,
    valid: USERNAME_PATTERN.test(username),
    skip: user.username,
  });
  const emailStatus = useAvailability({
    field: 'email',
    value: email,
    valid: !errors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    skip: user.email,
  });

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (updated) => {
      setSessionUser(updated);
      toast({ title: t('saved'), variant: 'success' });
      if (updated.language !== locale) router.replace(pathname, { locale: updated.language });
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('username')}
            htmlFor="profile-username"
            error={errors.username?.message}
            hint={<AvailabilityHint status={usernameStatus} />}
          >
            <Input
              id="profile-username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              invalid={!!errors.username}
              aria-describedby={describedBy(
                'profile-username',
                errors.username?.message,
                usernameStatus !== 'idle',
              )}
              {...form.register('username')}
            />
          </Field>
          <Field
            label={t('email')}
            htmlFor="profile-email"
            error={errors.email?.message}
            hint={<AvailabilityHint status={emailStatus} />}
          >
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              invalid={!!errors.email}
              aria-describedby={describedBy(
                'profile-email',
                errors.email?.message,
                emailStatus !== 'idle',
              )}
              {...form.register('email')}
            />
          </Field>
          <Field
            label={t('fullName')}
            htmlFor="profile-full-name"
            error={errors.full_name?.message}
          >
            <Input
              id="profile-full-name"
              autoComplete="name"
              invalid={!!errors.full_name}
              aria-describedby={describedBy('profile-full-name', errors.full_name?.message)}
              {...form.register('full_name')}
            />
          </Field>
          <Field
            label={t('language')}
            htmlFor="profile-language"
            error={errors.language?.message}
            hint={t('languageHint')}
          >
            <Select
              id="profile-language"
              invalid={!!errors.language}
              aria-describedby={describedBy('profile-language', errors.language?.message, true)}
              {...form.register('language')}
            >
              {routing.locales.map((item) => (
                <option key={item} value={item}>
                  {tl(item)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <PendingButton type="submit" pending={mutation.isPending} disabled={!isDirty}>
            {t('save')}
          </PendingButton>
        </div>
      </form>
    </section>
  );
}
