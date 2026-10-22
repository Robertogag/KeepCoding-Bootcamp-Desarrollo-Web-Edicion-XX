import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthCard } from '@/components/auth/AuthCard';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Link } from '@/i18n/navigation';

interface RegisterPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.register' });
  return { title: t('title'), robots: { index: false } };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth.register');

  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-fg underline-offset-2 hover:underline">
            {t('login')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
