import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CatalogsPanel } from '@/components/catalogs/CatalogsPanel';

interface CatalogsPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: CatalogsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'catalogs' });
  return { title: t('title') };
}

export default async function CatalogsPage({ params }: CatalogsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CatalogsPanel />;
}
