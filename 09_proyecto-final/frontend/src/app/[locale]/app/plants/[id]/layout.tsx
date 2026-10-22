import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PlantLayout } from '@/components/plants/PlantLayout';

interface PlantRouteLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function PlantRouteLayout({ children, params }: PlantRouteLayoutProps) {
  const { id } = await params;
  const plantId = Number(id);
  if (!Number.isInteger(plantId) || plantId <= 0) notFound();
  return <PlantLayout plantId={plantId}>{children}</PlantLayout>;
}
