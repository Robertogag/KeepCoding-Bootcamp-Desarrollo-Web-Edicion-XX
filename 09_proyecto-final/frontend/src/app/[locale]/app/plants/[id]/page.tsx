import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlantBoard } from '@/components/plants/PlantBoard';

interface PlantBoardPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PlantBoardPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plants.nav' });
  return { title: t('board') };
}

export default async function PlantBoardPage({ params }: PlantBoardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlantBoard />;
}
