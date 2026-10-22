import { request } from './client';
import type { Paginated, Shift, ShiftInput } from './types';

export function listShifts(plantId: number) {
  return request<Paginated<Shift>>(`/plants/${plantId}/shifts`, { query: { page_size: 100 } });
}

export function createShift(plantId: number, input: ShiftInput) {
  return request<Shift>(`/plants/${plantId}/shifts`, { method: 'POST', body: input });
}

export function updateShift(id: number, input: Partial<ShiftInput>) {
  return request<Shift>(`/shifts/${id}`, { method: 'PATCH', body: input });
}

export function deleteShift(id: number) {
  return request<void>(`/shifts/${id}`, { method: 'DELETE' });
}
