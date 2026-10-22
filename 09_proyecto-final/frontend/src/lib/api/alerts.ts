import { request } from './client';
import type { AlertRule, AlertRuleInput, Paginated } from './types';

export function listAlertRules(plantId: number) {
  return request<Paginated<AlertRule>>(`/plants/${plantId}/alert-rules`, {
    query: { page_size: 100 },
  });
}

export function createAlertRule(plantId: number, input: AlertRuleInput) {
  return request<AlertRule>(`/plants/${plantId}/alert-rules`, { method: 'POST', body: input });
}

export function updateAlertRule(id: number, input: Partial<AlertRuleInput>) {
  return request<AlertRule>(`/alert-rules/${id}`, { method: 'PATCH', body: input });
}

export function deleteAlertRule(id: number) {
  return request<void>(`/alert-rules/${id}`, { method: 'DELETE' });
}
