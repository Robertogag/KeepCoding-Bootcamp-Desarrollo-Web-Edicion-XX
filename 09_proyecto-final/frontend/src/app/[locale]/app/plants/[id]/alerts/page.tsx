import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertRulesPanel } from '@/components/alerts/AlertRulesPanel';

interface AlertsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: AlertsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'alerts' });
  return { title: t('title') };
}

export default async function AlertsPage({ params }: AlertsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AlertRulesPanel />;
}
