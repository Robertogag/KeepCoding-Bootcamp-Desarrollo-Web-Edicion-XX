import { request } from './client';
import type {
  CatalogInput,
  DowntimeFilters,
  Employee,
  EmployeeInput,
  LineDowntime,
  LineDowntimeInput,
  MachineVariable,
  MachineVariableInput,
  Mold,
  MoldInput,
  OrderFilters,
  OrderStatus,
  Paginated,
  Product,
  ProductInput,
  ProductionContext,
  ProductionLine,
  ProductionOrder,
  ProductionOrderInput,
  ProductionRun,
  Recipe,
  RecipeInput,
  Resin,
  ResinInput,
  ResinLot,
  ResinLotFilters,
  ResinLotInput,
  RunAssignment,
  RunAssignmentInput,
  RunFilters,
  RunMaterial,
  RunMaterialInput,
  RunStartInput,
  TelemetryFilters,
  TelemetrySample,
  Traceability,
  BoardPosition,
  PlantBoardData,
  PlantLayoutData,
  SeriesFilters,
  TelemetrySeriesResponse,
} from './types';

export interface CatalogMap {
  'production-lines': { item: ProductionLine; input: CatalogInput };
  products: { item: Product; input: ProductInput };
  molds: { item: Mold; input: MoldInput };
  resins: { item: Resin; input: ResinInput };
  employees: { item: Employee; input: EmployeeInput };
  'injection-recipes': { item: Recipe; input: RecipeInput };
}

export type CatalogResource = keyof CatalogMap;

const CATALOG_PAGE = 100;

export function listCatalog<R extends CatalogResource>(
  plantId: number,
  resource: R,
  page = 1,
  pageSize = CATALOG_PAGE,
) {
  return request<Paginated<CatalogMap[R]['item']>>(`/plants/${plantId}/${resource}`, {
    query: { page, page_size: pageSize },
  });
}

// Los catálogos se usan como selectores: se cargan todas las páginas, no solo la primera.
export async function listAllCatalog<R extends CatalogResource>(
  plantId: number,
  resource: R,
): Promise<CatalogMap[R]['item'][]> {
  const items: CatalogMap[R]['item'][] = [];
  let page = 1;
  for (;;) {
    const result = await listCatalog(plantId, resource, page);
    items.push(...result.items);
    if (!result.has_next || result.items.length === 0) return items;
    page += 1;
  }
}

export function createCatalogItem<R extends CatalogResource>(
  plantId: number,
  resource: R,
  input: CatalogMap[R]['input'],
) {
  return request<CatalogMap[R]['item']>(`/plants/${plantId}/${resource}`, {
    method: 'POST',
    body: input,
  });
}

export function updateCatalogItem<R extends CatalogResource>(
  plantId: number,
  resource: R,
  itemId: number,
  input: CatalogMap[R]['input'],
) {
  return request<CatalogMap[R]['item']>(`/plants/${plantId}/${resource}/${itemId}`, {
    method: 'PUT',
    body: input,
  });
}

export function setMachineLine(machineId: number, lineId: number | null) {
  return request<{ machine_id: number; line_id: number | null }>(`/machines/${machineId}/line`, {
    method: 'PUT',
    body: { line_id: lineId },
  });
}

export function listResinLots(plantId: number, filters: ResinLotFilters = {}) {
  return request<Paginated<ResinLot>>(`/plants/${plantId}/injection/resin-lots`, {
    query: { ...filters },
  });
}

export function createResinLot(plantId: number, input: ResinLotInput) {
  return request<ResinLot>(`/plants/${plantId}/resin-lots`, { method: 'POST', body: input });
}

export function listOrders(plantId: number, filters: OrderFilters = {}) {
  return request<Paginated<ProductionOrder>>(`/plants/${plantId}/injection/production-orders`, {
    query: { ...filters },
  });
}

export function createOrder(plantId: number, input: ProductionOrderInput) {
  return request<ProductionOrder>(`/plants/${plantId}/production-orders`, {
    method: 'POST',
    body: input,
  });
}

export function updateOrderStatus(orderId: number, status: Exclude<OrderStatus, 'running'>) {
  return request<ProductionOrder>(`/production-orders/${orderId}`, {
    method: 'PATCH',
    body: { status },
  });
}

export function listRuns(plantId: number, filters: RunFilters = {}) {
  return request<Paginated<ProductionRun>>(`/plants/${plantId}/injection/production-runs`, {
    query: { ...filters },
  });
}

export function startRun(machineId: number, input: RunStartInput) {
  return request<ProductionRun>(`/machines/${machineId}/production-runs`, {
    method: 'POST',
    body: input,
  });
}

export function endRun(runId: number) {
  return request<ProductionRun>(`/production-runs/${runId}/end`, { method: 'POST' });
}

export function addRunMaterial(runId: number, input: RunMaterialInput) {
  return request<RunMaterial>(`/production-runs/${runId}/materials`, {
    method: 'POST',
    body: input,
  });
}

export function assignRunEmployee(runId: number, input: RunAssignmentInput) {
  return request<RunAssignment>(`/production-runs/${runId}/employees`, {
    method: 'POST',
    body: input,
  });
}

export function endRunAssignment(runId: number, assignmentId: number) {
  return request<RunAssignment>(`/production-runs/${runId}/employees/${assignmentId}/end`, {
    method: 'POST',
  });
}

export function getTraceability(runId: number) {
  return request<Traceability>(`/production-runs/${runId}/traceability`);
}

export function getProductionContext(machineId: number) {
  return request<ProductionContext>(`/machines/${machineId}/production-context`);
}

export function listLineDowntimes(plantId: number, filters: DowntimeFilters = {}) {
  return request<Paginated<LineDowntime>>(`/plants/${plantId}/injection/line-downtimes`, {
    query: { ...filters },
  });
}

export function openLineDowntime(lineId: number, input: LineDowntimeInput) {
  return request<LineDowntime>(`/production-lines/${lineId}/downtimes`, {
    method: 'POST',
    body: input,
  });
}

export function closeLineDowntime(downtimeId: number) {
  return request<LineDowntime>(`/line-downtimes/${downtimeId}/end`, { method: 'POST' });
}

export function listVariables(machineId: number, page = 1) {
  return request<Paginated<MachineVariable>>(`/machines/${machineId}/variables`, {
    query: { page, page_size: CATALOG_PAGE },
  });
}

export async function listAllVariables(machineId: number): Promise<MachineVariable[]> {
  const items: MachineVariable[] = [];
  let page = 1;
  for (;;) {
    const result = await listVariables(machineId, page);
    items.push(...result.items);
    if (!result.has_next || result.items.length === 0) return items;
    page += 1;
  }
}

export function upsertVariable(machineId: number, code: string, input: MachineVariableInput) {
  return request<MachineVariable>(`/machines/${machineId}/variables/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: input,
  });
}

export function listTelemetry(machineId: number, filters: TelemetryFilters) {
  return request<Paginated<TelemetrySample>>(`/machines/${machineId}/telemetry`, {
    query: { ...filters },
  });
}

export function getPlantBoard(plantId: number) {
  return request<PlantBoardData>(`/plants/${plantId}/board`);
}

export function getPlantLayout(plantId: number) {
  return request<PlantLayoutData>(`/plants/${plantId}/layout`);
}

export function savePlantLayout(plantId: number, positions: BoardPosition[]) {
  return request<PlantLayoutData>(`/plants/${plantId}/layout`, {
    method: 'PUT',
    body: { positions },
  });
}

// `codes` va repetido en la URL (codes=a&codes=b), por eso se arma a mano.
export function getTelemetrySeries(machineId: number, filters: SeriesFilters) {
  const params = new URLSearchParams();
  params.set('from', filters.from);
  params.set('to', filters.to);
  for (const code of filters.codes) params.append('codes', code);
  if (filters.max_points) params.set('max_points', String(filters.max_points));
  if (filters.bucket_s) params.set('bucket_s', String(filters.bucket_s));
  if (filters.run_id) params.set('run_id', String(filters.run_id));
  return request<TelemetrySeriesResponse>(`/machines/${machineId}/telemetry/series?${params}`);
}
