import { request } from './client';
import type { Member, PlantRole } from './types';

export function addMember(plantId: number, username: string, role: PlantRole) {
  return request<Member>(`/plants/${plantId}/members`, {
    method: 'POST',
    body: { username, role },
  });
}

export function updateMemberRole(plantId: number, userId: number, role: PlantRole) {
  return request<Member>(`/plants/${plantId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  });
}

export function removeMember(plantId: number, userId: number) {
  return request<void>(`/plants/${plantId}/members/${userId}`, { method: 'DELETE' });
}
