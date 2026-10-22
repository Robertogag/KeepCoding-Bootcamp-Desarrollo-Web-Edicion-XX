import { request } from './client';
import type { Paginated, WatchlistItem } from './types';

export function listWatchlist(page = 1) {
  return request<Paginated<WatchlistItem>>('/watchlist', { query: { page, page_size: 24 } });
}

export function followMachine(machineId: number) {
  return request<void>(`/watchlist/${machineId}`, { method: 'PUT' });
}

export function unfollowMachine(machineId: number) {
  return request<void>(`/watchlist/${machineId}`, { method: 'DELETE' });
}
