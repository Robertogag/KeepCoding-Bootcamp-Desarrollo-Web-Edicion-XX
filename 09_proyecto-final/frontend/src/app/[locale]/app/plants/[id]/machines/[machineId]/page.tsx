import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MachineDetail } from '@/components/machines/MachineDetail';

interface MachinePageProps {
  params: Promise<{ locale: string; id: string; machineId: string }>;
}

export async function generateMetadata({ params }: MachinePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'machines' });
  return { title: t('detail') };
}

export default async function MachinePage({ params }: MachinePageProps) {
  const { locale, machineId } = await params;
  setRequestLocale(locale);
  const id = Number(machineId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <MachineDetail machineId={id} />;
}
