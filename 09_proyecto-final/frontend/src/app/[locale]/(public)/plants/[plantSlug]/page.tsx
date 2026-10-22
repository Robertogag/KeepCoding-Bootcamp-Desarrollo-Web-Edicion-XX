import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicPlantBoard } from '@/components/public/PublicPlantBoard';
import { isApiError } from '@/lib/api/client';
import { loadPublicPlant } from '@/lib/api/public';
import type { PublicPlant } from '@/lib/api/types';
import { pageMetadata } from '@/lib/seo';

interface PlantPageProps {
  params: Promise<{ locale: string; plantSlug: string }>;
}

async function loadOrNotFound(slug: string): Promise<PublicPlant> {
  try {
    return await loadPublicPlant(slug);
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PlantPageProps): Promise<Metadata> {
  const { locale, plantSlug } = await params;
  const plant = await loadOrNotFound(plantSlug);
  const t = await getTranslations({ locale, namespace: 'publicPlant' });
  return pageMetadata({
    locale,
    path: `/plants/${plant.slug}`,
    title: t('metaTitle', { name: plant.name }),
    description: t('metaDescription', { name: plant.name, count: plant.machines.length }),
  });
}

export default async function PublicPlantPage({ params }: PlantPageProps) {
  const { locale, plantSlug } = await params;
  setRequestLocale(locale);
  const plant = await loadOrNotFound(plantSlug);
  return <PublicPlantBoard initial={plant} />;
}
