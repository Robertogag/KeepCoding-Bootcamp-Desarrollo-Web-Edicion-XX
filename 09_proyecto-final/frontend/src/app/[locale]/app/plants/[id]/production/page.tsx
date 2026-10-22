import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductionPanel } from '@/components/production/ProductionPanel';

interface ProductionPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: ProductionPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'production' });
  return { title: t('title') };
}

export default async function ProductionPage({ params }: ProductionPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductionPanel />;
}
