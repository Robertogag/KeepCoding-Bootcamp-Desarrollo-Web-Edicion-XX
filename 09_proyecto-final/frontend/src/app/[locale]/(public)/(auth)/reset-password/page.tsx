import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

interface ResetPasswordPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: ResetPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.reset' });
  return { title: t('title'), robots: { index: false } };
}

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations('auth.reset');

  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')}>
      <ResetPasswordForm token={token?.trim() || null} />
    </AuthCard>
  );
}
