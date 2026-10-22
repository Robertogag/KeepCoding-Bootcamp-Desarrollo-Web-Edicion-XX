import { request } from './client';
import type { Member, Paginated, Plant, PlantInput } from './types';

export function listPlants(page = 1) {
  return request<Paginated<Plant>>('/plants', { query: { page, page_size: 100 } });
}

export function getPlant(id: number) {
  return request<Plant>(`/plants/${id}`);
}

export function createPlant(input: PlantInput) {
  return request<Plant>('/plants', { method: 'POST', body: input });
}

export function updatePlant(id: number, input: Partial<PlantInput>) {
  return request<Plant>(`/plants/${id}`, { method: 'PATCH', body: input });
}

export function deletePlant(id: number) {
  return request<void>(`/plants/${id}`, { method: 'DELETE' });
}

export function listMembers(plantId: number) {
  return request<Paginated<Member>>(`/plants/${plantId}/members`, { query: { page_size: 100 } });
}

// Plantas que desaparecerían con la cuenta: las que tienen a este usuario como único owner.
export async function listSoleOwnedPlants(): Promise<Plant[]> {
  const plants = await listPlants(1);
  const owned = plants.items.filter((plant) => plant.role === 'owner');
  const checks = await Promise.all(
    owned.map(async (plant) => {
      const members = await listMembers(plant.id);
      const owners = members.items.filter((member) => member.role === 'owner').length;
      return owners === 1 ? plant : null;
    }),
  );
  return checks.filter((plant): plant is Plant => plant !== null);
}
