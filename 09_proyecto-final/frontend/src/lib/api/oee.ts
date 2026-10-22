import { request, requestBlob } from './client';
import type {
  DowntimeReason,
  EventFilters,
  Granularity,
  MachineEvent,
  OeeRow,
  Paginated,
  PlantSummary,
} from './types';

export interface OeeSeriesParams {
  from: string;
  to: string;
  granularity: Granularity;
}

export function getMachineOee(machineId: number, params: OeeSeriesParams) {
  return request<OeeRow[]>(`/machines/${machineId}/oee`, { query: { ...params } });
}

export function getPlantSummary(plantId: number, date?: string) {
  return request<PlantSummary>(`/plants/${plantId}/oee/summary`, { query: { date } });
}

export function listEvents(machineId: number, filters: EventFilters = {}) {
  return request<Paginated<MachineEvent>>(`/machines/${machineId}/events`, {
    query: { ...filters },
  });
}

export function updateEvent(
  eventId: number,
  input: { reason_code: string | null; comment: string | null },
) {
  return request<MachineEvent>(`/events/${eventId}`, { method: 'PATCH', body: input });
}

export function listDowntimeReasons() {
  return request<Paginated<DowntimeReason>>('/downtime-reasons', { query: { page_size: 100 } });
}

export function downloadOeeCsv(plantId: number, from: string, to: string) {
  return requestBlob(`/plants/${plantId}/reports/oee.csv`, { query: { from, to } });
}
