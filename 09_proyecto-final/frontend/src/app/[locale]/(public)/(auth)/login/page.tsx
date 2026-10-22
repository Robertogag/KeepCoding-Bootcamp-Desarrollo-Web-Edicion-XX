import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';
import { Link } from '@/i18n/navigation';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login' });
  return { title: t('title'), robots: { index: false } };
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations('auth.login');

  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="font-medium text-fg underline-offset-2 hover:underline">
            {t('register')}
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
