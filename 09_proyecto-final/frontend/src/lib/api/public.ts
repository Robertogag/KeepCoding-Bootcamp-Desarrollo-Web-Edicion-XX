import { cache } from 'react';
import { request } from './client';
import type { Paginated, PublicMachineDetail, PublicPlant, PublicPlantListItem } from './types';

export function listPublicPlants(page = 1) {
  return request<Paginated<PublicPlantListItem>>('/public/plants', { query: { page } });
}

export function getPublicPlant(slug: string) {
  return request<PublicPlant>(`/public/plants/${encodeURIComponent(slug)}`);
}

export function getPublicMachine(plantSlug: string, machineSlug: string) {
  return request<PublicMachineDetail>(
    `/public/plants/${encodeURIComponent(plantSlug)}/machines/${encodeURIComponent(machineSlug)}`,
  );
}

// En servidor, generateMetadata y la página comparten la misma petición.
export const loadPublicPlant = cache(getPublicPlant);
export const loadPublicMachine = cache(getPublicMachine);

export async function listAllPublicPlants(): Promise<PublicPlantListItem[]> {
  const items: PublicPlantListItem[] = [];
  let page = 1;
  for (;;) {
    const result = await listPublicPlants(page);
    items.push(...result.items);
    if (!result.has_next || page >= 50) return items;
    page += 1;
  }
}
