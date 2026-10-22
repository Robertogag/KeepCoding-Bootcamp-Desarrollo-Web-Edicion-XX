import { request } from './client';
import type { AppNotification, Paginated } from './types';

export function listNotifications(
  params: { unread?: boolean; page?: number; page_size?: number } = {},
) {
  return request<Paginated<AppNotification>>('/notifications', {
    query: {
      unread: params.unread ? 'true' : undefined,
      page: params.page,
      page_size: params.page_size,
    },
  });
}

export async function countUnread(): Promise<number> {
  const result = await listNotifications({ unread: true, page_size: 1 });
  return result.total;
}

export function markNotificationRead(id: number) {
  return request<void>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return request<void>('/notifications/read-all', { method: 'POST' });
}
