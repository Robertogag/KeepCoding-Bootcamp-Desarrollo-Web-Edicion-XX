import { request } from './client';
import type { ConnectionTest, Machine, MachineFilters, MachineInput, Paginated } from './types';

export interface ConnectionInput {
  host: string;
  port: number;
  unit_id: number;
}

export function listMachines(plantId: number, filters: MachineFilters = {}) {
  return request<Paginated<Machine>>(`/plants/${plantId}/machines`, { query: { ...filters } });
}

export function getMachine(id: number) {
  return request<Machine>(`/machines/${id}`);
}

export function createMachine(plantId: number, input: MachineInput) {
  return request<Machine>(`/plants/${plantId}/machines`, { method: 'POST', body: input });
}

export function updateMachine(id: number, input: Partial<MachineInput>) {
  return request<Machine>(`/machines/${id}`, { method: 'PATCH', body: input });
}

export function deleteMachine(id: number) {
  return request<void>(`/machines/${id}`, { method: 'DELETE' });
}

export function uploadMachinePhoto(id: number, file: File) {
  const body = new FormData();
  body.append('file', file);
  return request<Machine>(`/machines/${id}/photo`, { method: 'POST', body });
}

export function testConnection(plantId: number, input: ConnectionInput) {
  return request<ConnectionTest>(`/plants/${plantId}/machines/test-connection`, {
    method: 'POST',
    body: input,
  });
}
