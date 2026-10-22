import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MachineEditor } from '@/components/machines/MachineEditor';

interface EditMachinePageProps {
  params: Promise<{ locale: string; id: string; machineId: string }>;
}

export async function generateMetadata({ params }: EditMachinePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'machines' });
  return { title: t('edit') };
}

export default async function EditMachinePage({ params }: EditMachinePageProps) {
  const { locale, machineId } = await params;
  setRequestLocale(locale);
  const id = Number(machineId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const t = await getTranslations('machines');
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t('edit')}</h2>
      <MachineEditor machineId={id} />
    </div>
  );
}
