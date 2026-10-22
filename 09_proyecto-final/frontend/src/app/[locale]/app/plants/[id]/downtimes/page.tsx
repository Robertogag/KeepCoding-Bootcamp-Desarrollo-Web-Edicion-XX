import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LineDowntimesPanel } from '@/components/downtimes/LineDowntimesPanel';
import { MachineDowntimesPanel } from '@/components/downtimes/MachineDowntimesPanel';

interface DowntimesPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: DowntimesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'downtimes' });
  return { title: t('title') };
}

export default async function DowntimesPage({ params }: DowntimesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-10">
      <MachineDowntimesPanel />
      <LineDowntimesPanel />
    </div>
  );
}
