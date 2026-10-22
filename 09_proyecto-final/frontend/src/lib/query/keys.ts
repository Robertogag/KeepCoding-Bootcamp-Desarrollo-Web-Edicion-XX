import type {
  DowntimeFilters,
  EventFilters,
  MachineFilters,
  OrderFilters,
  ResinLotFilters,
  RunFilters,
  TelemetryFilters,
} from '@/lib/api/types';

export const queryKeys = {
  availability: (field: 'username' | 'email', value: string) =>
    ['availability', field, value] as const,
  soleOwnedPlants: ['profile', 'sole-owned-plants'] as const,
  reasons: ['downtime-reasons'] as const,
  watchlist: ['watchlist'] as const,
  notifications: {
    all: ['notifications'] as const,
    list: (unread: boolean, page: number) => ['notifications', 'list', unread, page] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  plants: {
    all: ['plants'] as const,
    list: (page: number) => ['plants', 'list', page] as const,
    detail: (id: number) => ['plants', id] as const,
    members: (id: number) => ['plants', id, 'members'] as const,
    shifts: (id: number) => ['plants', id, 'shifts'] as const,
    alertRules: (id: number) => ['plants', id, 'alert-rules'] as const,
    report: (id: number, from: string, to: string) => ['plants', id, 'report', from, to] as const,
    summary: (id: number, date: string | undefined) => ['plants', id, 'summary', date] as const,
  },
  machines: {
    list: (plantId: number, filters: MachineFilters) =>
      ['plants', plantId, 'machines', filters] as const,
    brands: (plantId: number) => ['plants', plantId, 'machines', 'brands'] as const,
    detail: (id: number) => ['machines', id] as const,
    oee: (id: number, from: string, to: string, granularity: string) =>
      ['machines', id, 'oee', granularity, from, to] as const,
    events: (id: number, filters: EventFilters) => ['machines', id, 'events', filters] as const,
    context: (id: number) => ['machines', id, 'production-context'] as const,
    variables: (id: number) => ['machines', id, 'variables'] as const,
    telemetry: (id: number, filters: TelemetryFilters) =>
      ['machines', id, 'telemetry', filters] as const,
  },
  injection: {
    catalog: (plantId: number, resource: string) =>
      ['plants', plantId, 'catalog', resource] as const,
    lots: (plantId: number, filters: ResinLotFilters) =>
      ['plants', plantId, 'injection', 'lots', filters] as const,
    orders: (plantId: number, filters: OrderFilters) =>
      ['plants', plantId, 'injection', 'orders', filters] as const,
    runs: (plantId: number, filters: RunFilters) =>
      ['plants', plantId, 'injection', 'runs', filters] as const,
    downtimes: (plantId: number, filters: DowntimeFilters) =>
      ['plants', plantId, 'injection', 'downtimes', filters] as const,
    traceability: (runId: number) => ['runs', runId, 'traceability'] as const,
  },
  public: {
    plants: (page: number) => ['public', 'plants', page] as const,
    plant: (slug: string) => ['public', 'plant', slug] as const,
    machine: (plantSlug: string, machineSlug: string) =>
      ['public', 'plant', plantSlug, 'machine', machineSlug] as const,
  },
};
