import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { Link } from '@/i18n/navigation';

interface ForgotPasswordPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgot' });
  return { title: t('title'), robots: { index: false } };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.forgot');

  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href="/login" className="font-medium text-fg underline-offset-2 hover:underline">
          {t('back')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
