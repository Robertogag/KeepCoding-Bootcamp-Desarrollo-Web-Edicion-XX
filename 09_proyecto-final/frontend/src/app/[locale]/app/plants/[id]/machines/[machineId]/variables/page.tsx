import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VariablesPanel } from '@/components/machines/VariablesPanel';

interface VariablesPageProps {
  params: Promise<{ locale: string; id: string; machineId: string }>;
}

export async function generateMetadata({ params }: VariablesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'variables' });
  return { title: t('title') };
}

export default async function VariablesPage({ params }: VariablesPageProps) {
  const { locale, machineId } = await params;
  setRequestLocale(locale);
  const id = Number(machineId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <VariablesPanel machineId={id} />;
}
