import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShiftsPanel } from '@/components/shifts/ShiftsPanel';

interface ShiftsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: ShiftsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shifts' });
  return { title: t('title') };
}

export default async function ShiftsPage({ params }: ShiftsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ShiftsPanel />;
}
