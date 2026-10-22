export type Locale = 'es' | 'en';
export type MachineState = 'RUNNING' | 'IDLE' | 'DOWN' | 'OFFLINE';
export type PlantRole = 'owner' | 'supervisor' | 'viewer';
export type AlertType = 'MACHINE_DOWN' | 'MACHINE_OFFLINE' | 'OEE_BELOW';
export type Granularity = 'hour' | 'shift' | 'day';
export type ReasonCategory =
  'mecanica' | 'electrica' | 'material' | 'calidad' | 'organizacional' | 'otro';

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ApiErrorBody {
  error: { code: string; field?: string };
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  language: Locale;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
}

export interface Availability {
  username_available: boolean;
  email_available: boolean;
}

export interface OeeMetrics {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
}

export interface OeeTotals extends OeeMetrics {
  good: number;
  reject: number;
  run_s: number;
  planned_s: number;
}

export interface OeeRow extends OeeTotals {
  bucket_start: string;
}

export interface Snapshot {
  state: MachineState;
  since: string | null;
  good: number;
  reject: number;
  alarm_code: number;
  last_cycle_s: number | null;
  oee_today: OeeMetrics;
}

export interface Photo {
  sm: string;
  md: string;
  lg: string;
}

export interface Plant {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  is_public: boolean;
  role: PlantRole;
  created_at: string;
  machine_count: number;
  oee_today: OeeMetrics;
}

export interface PlantInput {
  name: string;
  timezone: string;
  is_public: boolean;
}

export interface Member {
  user_id: number;
  username: string;
  full_name: string;
  role: PlantRole;
}

export interface Machine {
  id: number;
  plant_id: number;
  slug: string;
  name: string;
  brand: string;
  model: string;
  host: string;
  port: number;
  unit_id: number;
  ideal_cycle_s: number;
  is_active: boolean;
  photo: Photo | null;
  snapshot: Snapshot;
  is_watched: boolean;
  line_id: number | null;
  created_at: string;
}

export interface MachineInput {
  name: string;
  brand: string;
  model: string;
  host: string;
  port: number;
  unit_id: number;
  ideal_cycle_s: number;
  is_active: boolean;
}

export interface MachineFilters {
  search?: string;
  state?: MachineState;
  brand?: string;
  page?: number;
  page_size?: number;
}

export interface ConnectionTest {
  ok: true;
  latency_ms: number;
  registers: {
    state: number;
    good_count: number;
    reject_count: number;
    alarm_code: number;
    last_cycle_ds: number;
    heartbeat: number;
    ideal_cycle_ds: number;
  };
}

export interface Shift {
  id: number;
  plant_id: number;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
}

export type ShiftInput = Omit<Shift, 'id' | 'plant_id'>;

export interface DowntimeReason {
  code: string;
  label_es: string;
  label_en: string;
  category: ReasonCategory;
}

export interface MachineEvent {
  id: number;
  machine_id: number;
  state: MachineState;
  reason_code: string | null;
  reason: DowntimeReason | null;
  comment: string | null;
  classified_by: { id: number; username: string } | null;
  started_at: string;
  ended_at: string | null;
}

export interface EventFilters {
  from?: string;
  to?: string;
  state?: MachineState;
  page?: number;
  page_size?: number;
}

export interface PlantSummaryMachine extends OeeTotals {
  machine_id: number;
  name: string;
  slug: string;
  state: MachineState;
}

export interface PlantSummary {
  plant: OeeTotals;
  machines: PlantSummaryMachine[];
}

export interface AlertRule {
  id: number;
  plant_id: number;
  machine_id: number | null;
  type: AlertType;
  threshold: number | null;
  duration_s: number;
  is_active: boolean;
}

export type AlertRuleInput = Omit<AlertRule, 'id' | 'plant_id'>;

export interface NotificationPayload {
  plant_id: number;
  machine_id: number;
  machine_name: string;
  reason_code?: string | null;
  duration_s?: number;
  oee?: number;
  threshold?: number;
}

export interface AppNotification {
  id: number;
  type: AlertType;
  created_at: string;
  read_at: string | null;
  payload: NotificationPayload;
}

export interface WatchlistItem extends Machine {
  plant: Pick<Plant, 'id' | 'slug' | 'name' | 'timezone'>;
}

export interface PublicPlantListItem {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  machine_count: number;
  oee_today: OeeMetrics;
  created_at: string;
}

export interface PublicMachine {
  id: number;
  slug: string;
  name: string;
  brand: string;
  model: string;
  photo: Photo | null;
  snapshot: Snapshot;
}

export interface PublicPlant {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  oee_today: OeeMetrics;
  machines: PublicMachine[];
}

export interface PublicMachineDetail extends PublicMachine {
  ideal_cycle_s: number;
  plant: Pick<Plant, 'id' | 'slug' | 'name' | 'timezone'>;
  trend: OeeRow[];
}

export interface SnapshotMessage {
  type: 'machine.snapshot';
  plant_id: number;
  machine_id: number;
  snapshot: Snapshot;
  ts: string;
}

export interface NotificationMessage {
  type: 'notification';
  notification: AppNotification;
}

export interface PingMessage {
  type: 'ping';
}

export type ServerMessage = SnapshotMessage | NotificationMessage | PingMessage;

export type OrderStatus = 'planned' | 'running' | 'completed' | 'cancelled';
export type AssignmentRole = 'operator' | 'technician' | 'quality' | 'supervisor';
export type VariableDataType = 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32';
export type WordOrder = 'big' | 'little';
export type TelemetryQuality = 'good' | 'bad' | 'stale' | 'unavailable';

export interface CatalogItem {
  id: number;
  plant_id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface CatalogInput {
  code: string;
  name: string;
  is_active: boolean;
}

export type ProductionLine = CatalogItem;

export interface Product extends CatalogItem {
  part_weight_g: number;
  description: string;
}

export interface ProductInput extends CatalogInput {
  part_weight_g: number;
  description: string;
}

export interface Mold extends CatalogItem {
  nominal_cavities: number;
}

export interface MoldInput extends CatalogInput {
  nominal_cavities: number;
}

export interface Resin extends CatalogItem {
  polymer: string;
  grade: string;
  manufacturer: string;
}

export interface ResinInput extends CatalogInput {
  polymer: string;
  grade: string;
  manufacturer: string;
}

export interface Employee extends CatalogItem {
  user_id: number | null;
}

export interface EmployeeInput extends CatalogInput {
  user_id: number | null;
}

export interface Recipe extends CatalogItem {
  product_id: number;
  mold_id: number;
  resin_id: number;
  ideal_cycle_s: number;
  active_cavities: number;
}

export interface RecipeInput extends CatalogInput {
  product_id: number;
  mold_id: number;
  resin_id: number;
  ideal_cycle_s: number;
  active_cavities: number;
}

export interface ResinLot {
  id: number;
  plant_id: number;
  resin_id: number;
  lot_code: string;
  received_kg: number;
  received_at: string;
}

export interface ResinLotInput {
  resin_id: number;
  lot_code: string;
  received_kg: number;
}

export interface ProductionOrder {
  id: number;
  plant_id: number;
  code: string;
  recipe_id: number;
  target_pieces: number;
  status: OrderStatus;
  created_at: string;
}

export interface ProductionOrderInput {
  code: string;
  recipe_id: number;
  target_pieces: number;
}

export interface RunContext {
  recipe_id: number;
  recipe_code: string;
  product_id: number;
  product_code: string;
  product_name: string;
  mold_code: string;
  mold_name?: string | null;
  resin_id: number;
  resin_code: string;
  resin_name?: string | null;
  polymer: string;
  grade: string;
  counter_unit: string;
  cycle_unit: string;
  line_id?: number | null;
  line_code?: string | null;
  line_name?: string | null;
}

export interface ProductionRun {
  id: number;
  plant_id: number;
  order_id: number;
  machine_id: number;
  mold_id: number;
  context: RunContext;
  nominal_cavities: number;
  active_cavities: number;
  ideal_cycle_s: number;
  part_weight_g: number;
  started_by: number | null;
  ended_by: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface RunStartInput {
  order_id: number;
  active_cavities?: number | null;
}

export interface RunMaterial {
  id: number;
  plant_id: number;
  run_id: number;
  resin_lot_id: number;
  consumed_kg: number;
  recorded_at: string;
  recorded_by: number | null;
}

export interface RunMaterialInput {
  resin_lot_id: number;
  consumed_kg: number;
}

export interface RunAssignment {
  id: number;
  plant_id: number;
  run_id: number;
  employee_id: number;
  role: AssignmentRole;
  started_at: string;
  ended_at: string | null;
}

export interface RunAssignmentInput {
  employee_id: number;
  role: AssignmentRole;
}

export interface Traceability {
  run: ProductionRun;
  materials: RunMaterial[];
  employees: RunAssignment[];
  ideal_seconds_per_piece: number;
}

export interface ProductionContext {
  run: ProductionRun | null;
  ideal_seconds_per_piece: number | null;
}

export interface LineDowntime {
  id: number;
  plant_id: number;
  line_id: number;
  reason_code: string;
  planned: boolean;
  comment: string;
  started_at: string;
  ended_at: string | null;
  created_by: number | null;
  ended_by: number | null;
  affected_machine_ids: number[];
}

export interface LineDowntimeInput {
  reason_code: string;
  planned: boolean;
  comment?: string;
}

export interface MachineVariable {
  id: number;
  machine_id: number;
  code: string;
  name: string;
  unit: string;
  address: number;
  data_type: VariableDataType;
  word_order: WordOrder;
  byte_order: WordOrder;
  scale: number;
  offset: number;
  is_active: boolean;
  map_version: string;
}

export interface MachineVariableInput {
  code: string;
  name: string;
  unit: string;
  address: number;
  data_type: VariableDataType;
  word_order: WordOrder;
  byte_order: WordOrder;
  scale: number;
  offset: number;
  is_active: boolean;
  map_version?: string;
}

export interface TelemetryMapping {
  id: number;
  code: string;
  unit: string;
  address: number;
  data_type: VariableDataType;
  word_order: WordOrder;
  byte_order: WordOrder;
  scale: number;
  offset: number;
  map_version?: string;
}

export interface TelemetryValue {
  value: number | null;
  unit: string;
  quality: TelemetryQuality;
  raw?: number | null;
  mapping?: TelemetryMapping | null;
  map_version?: string;
}

export interface TelemetrySample {
  machine_id: number;
  sampled_at: string;
  run_id: number | null;
  source: string;
  values: Record<string, TelemetryValue>;
}

export interface PageFilters {
  page?: number;
  page_size?: number;
}

export interface ResinLotFilters extends PageFilters {
  resin_id?: number;
  from?: string;
  to?: string;
}

export interface OrderFilters extends PageFilters {
  status?: OrderStatus;
  from?: string;
  to?: string;
}

export interface RunFilters extends PageFilters {
  machine_id?: number;
  line_id?: number;
  order_id?: number;
  open?: boolean;
  from?: string;
  to?: string;
}

export interface DowntimeFilters extends PageFilters {
  line_id?: number;
  machine_id?: number;
  open?: boolean;
  from?: string;
  to?: string;
}

export interface TelemetryFilters extends PageFilters {
  from: string;
  to: string;
}

export interface BoardRun {
  id: number;
  order_id: number;
  order_code: string;
  product_id: number;
  product_code: string;
  product_name: string;
  mold_id: number;
  mold_code: string;
  mold_name: string | null;
  nominal_cavities: number;
  active_cavities: number;
  ideal_cycle_s: number;
  ideal_seconds_per_piece: number;
  started_at: string;
}

export interface BoardPosition {
  machine_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  updated_at?: string;
}

export interface BoardMachine {
  id: number;
  name: string;
  slug: string;
  brand: string;
  model: string;
  is_active: boolean;
  line_id: number | null;
  position: BoardPosition | null;
  snapshot: Snapshot;
  observed_at: string | null;
  current_run: BoardRun | null;
}

export interface BoardStop {
  kind: 'line' | 'machine';
  id: number | null;
  line_id: number | null;
  machine_id: number | null;
  affected_machine_ids: number[];
  started_at: string | null;
  elapsed_s: number | null;
  reason_code: string | null;
  label_es: string | null;
  label_en: string | null;
  planned: boolean | null;
  comment: string | null;
}

export interface BoardSummary {
  machine_count: number;
  active_machine_count: number;
  states: Record<MachineState, number>;
  active_runs: number;
  without_active_run: number;
  line_stops: number;
  oee_today: OeeMetrics;
}

export interface PlantBoardData {
  generated_at: string;
  plant: Pick<Plant, 'id' | 'slug' | 'name' | 'timezone'>;
  scheduled_now: boolean;
  summary: BoardSummary;
  lines: Array<Pick<CatalogItem, 'id' | 'code' | 'name' | 'is_active'>>;
  machines: BoardMachine[];
  stops: BoardStop[];
}

export interface PlantLayoutData {
  plant_id: number;
  positions: BoardPosition[];
}

export interface SeriesCounts {
  good: number;
  bad: number;
  stale: number;
  unavailable: number;
  missing: number;
}

export interface SeriesPoint {
  bucket_start: string;
  bucket_end: string;
  avg: number | null;
  min: number | null;
  max: number | null;
  first: number | null;
  last: number | null;
  first_at: string | null;
  last_at: string | null;
  counts: SeriesCounts;
}

export interface TelemetrySeries {
  code: string;
  unit: string | null;
  map_version: string | null;
  mapping_key: string | null;
  points: SeriesPoint[];
}

export interface TelemetrySeriesResponse {
  machine_id: number;
  from: string;
  to: string;
  bucket_s: number;
  requested_codes: string[];
  max_points?: number;
  run_id?: number | null;
  total_points?: number;
  series: TelemetrySeries[];
}

export interface SeriesFilters {
  from: string;
  to: string;
  codes: string[];
  max_points?: number;
  bucket_s?: number;
  run_id?: number;
}
