import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel';

interface NotificationsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NotificationsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'notifications' });
  return { title: t('title') };
}

export default async function NotificationsPage({ params }: NotificationsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-3xl">
      <NotificationsPanel />
    </div>
  );
}
