import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlantForm } from '@/components/plants/PlantForm';

interface NewPlantPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: NewPlantPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plants' });
  return { title: t('newTitle') };
}

export default async function NewPlantPage({ params }: NewPlantPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('plants');

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('newTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('newSubtitle')}</p>
      </div>
      <div className="panel p-5">
        <PlantForm />
      </div>
    </div>
  );
}
