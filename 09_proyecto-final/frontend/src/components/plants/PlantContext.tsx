'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Plant } from '@/lib/api/types';

interface PlantContextValue {
  plant: Plant;
  canEdit: boolean;
  isOwner: boolean;
}

const PlantContext = createContext<PlantContextValue | null>(null);

export function PlantProvider({ plant, children }: { plant: Plant; children: ReactNode }) {
  const value = useMemo(
    () => ({ plant, canEdit: plant.role !== 'viewer', isOwner: plant.role === 'owner' }),
    [plant],
  );
  return <PlantContext.Provider value={value}>{children}</PlantContext.Provider>;
}

export function usePlant(): PlantContextValue {
  const value = useContext(PlantContext);
  if (!value) throw new Error('PlantProvider is missing');
  return value;
}
