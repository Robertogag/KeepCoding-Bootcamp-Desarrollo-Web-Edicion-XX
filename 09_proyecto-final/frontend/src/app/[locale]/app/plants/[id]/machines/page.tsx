import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { MachineTable } from '@/components/machines/MachineTable';
import { Skeleton } from '@/components/state/Skeleton';

interface MachinesPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: MachinesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'machines' });
  return { title: t('title') };
}

export default async function MachinesPage({ params }: MachinesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <MachineTable />
    </Suspense>
  );
}
