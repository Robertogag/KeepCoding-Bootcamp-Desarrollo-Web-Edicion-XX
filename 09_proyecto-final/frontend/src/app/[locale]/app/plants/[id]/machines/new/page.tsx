import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MachineForm } from '@/components/machines/MachineForm';

interface NewMachinePageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: NewMachinePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'machines' });
  return { title: t('new') };
}

export default async function NewMachinePage({ params }: NewMachinePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('machines');
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('new')}</h2>
      <MachineForm />
    </div>
  );
}
