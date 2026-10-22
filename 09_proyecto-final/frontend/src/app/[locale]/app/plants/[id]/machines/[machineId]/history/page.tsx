import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TelemetryHistoryPanel } from '@/components/machines/TelemetryHistoryPanel';

interface HistoryPageProps {
  params: Promise<{ locale: string; id: string; machineId: string }>;
}

export async function generateMetadata({ params }: HistoryPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'history' });
  return { title: t('link') };
}

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { locale, machineId } = await params;
  setRequestLocale(locale);
  const id = Number(machineId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <TelemetryHistoryPanel machineId={id} />;
}
