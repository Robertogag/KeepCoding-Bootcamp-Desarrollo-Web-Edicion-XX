import type {
  Employee,
  LineDowntime,
  MachineVariable,
  Mold,
  Product,
  ProductionLine,
  ProductionOrder,
  ProductionRun,
  Recipe,
  Resin,
  ResinLot,
  RunAssignment,
  RunContext,
  RunMaterial,
  TelemetryQuality,
  TelemetrySample,
  TelemetryValue,
  VariableDataType,
} from '@/lib/api/types';
import { mulberry32 } from './data';

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEMO_MAP = 'injection-demo-v1';
export const TELEMETRY_STEP = 10_000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function catalog<T extends { id: number; code: string; name: string }>(
  id: number,
  code: string,
  name: string,
  extra: Omit<T, 'id' | 'plant_id' | 'code' | 'name' | 'is_active' | 'created_at'>,
  plantId = 1,
): T {
  return {
    id,
    plant_id: plantId,
    code,
    name,
    is_active: true,
    created_at: iso(NOW - 60 * DAY + id * HOUR),
    ...extra,
  } as unknown as T;
}

interface VariableSpec {
  code: string;
  name: string;
  unit: string;
  address: number;
  data_type: VariableDataType;
  base: number;
  spread: number;
}

// Mapa solo demo (convenciones del simulador), igual que el del backend.
export const DEMO_VARIABLES: VariableSpec[] = [
  {
    code: 'filling_time_s',
    name: 'Tiempo de llenado',
    unit: 's',
    address: 9,
    data_type: 'float32',
    base: 1.8,
    spread: 0.2,
  },
  {
    code: 'dose_time_s',
    name: 'Tiempo de dosificación',
    unit: 's',
    address: 11,
    data_type: 'float32',
    base: 6.5,
    spread: 0.5,
  },
  {
    code: 'min_cushion_position',
    name: 'Cojín mínimo',
    unit: 'mm',
    address: 13,
    data_type: 'float32',
    base: 4.2,
    spread: 0.3,
  },
  {
    code: 'vp_switchover_position',
    name: 'Conmutación V/P',
    unit: 'mm',
    address: 15,
    data_type: 'float32',
    base: 12,
    spread: 0.4,
  },
  {
    code: 'peak_injection_pressure',
    name: 'Presión pico de inyección',
    unit: 'bar',
    address: 17,
    data_type: 'float32',
    base: 1250,
    spread: 60,
  },
  {
    code: 'cooling_time_s',
    name: 'Tiempo de enfriamiento',
    unit: 's',
    address: 19,
    data_type: 'float32',
    base: 14,
    spread: 0.5,
  },
  {
    code: 'melt_temperature_c',
    name: 'Temperatura de masa',
    unit: '°C',
    address: 21,
    data_type: 'float32',
    base: 225,
    spread: 3,
  },
  {
    code: 'mold_temperature_c',
    name: 'Temperatura de molde',
    unit: '°C',
    address: 23,
    data_type: 'float32',
    base: 45,
    spread: 1.5,
  },
  {
    code: 'holding_pressure',
    name: 'Presión de sostenimiento',
    unit: 'bar',
    address: 25,
    data_type: 'float32',
    base: 650,
    spread: 30,
  },
  {
    code: 'clamp_force',
    name: 'Fuerza de cierre',
    unit: 'kN',
    address: 27,
    data_type: 'float32',
    base: 1600,
    spread: 20,
  },
  {
    code: 'shot_count',
    name: 'Contador de disparos',
    unit: '',
    address: 29,
    data_type: 'uint32',
    base: 0,
    spread: 0,
  },
  {
    code: 'active_cavities',
    name: 'Cavidades activas',
    unit: '',
    address: 31,
    data_type: 'uint16',
    base: 4,
    spread: 0,
  },
];

function demoVariables(machineId: number, firstId: number): MachineVariable[] {
  return DEMO_VARIABLES.map((spec, index) => ({
    id: firstId + index,
    machine_id: machineId,
    code: spec.code,
    name: spec.name,
    unit: spec.unit,
    address: spec.address,
    data_type: spec.data_type,
    word_order: 'big',
    byte_order: 'big',
    scale: 1,
    offset: 0,
    is_active: true,
    map_version: DEMO_MAP,
  }));
}

const lines: ProductionLine[] = [
  catalog<ProductionLine>(1, 'L1', 'Línea 1 · Inyección', {}),
  catalog<ProductionLine>(2, 'L2', 'Línea 2 · Prensas y ensamble', {}),
];

const products: Product[] = [
  catalog<Product>(1, 'P-001', 'Tapa 40 mm', {
    part_weight_g: 12.5,
    description: 'Tapa roscada para envase de 40 mm',
  }),
  catalog<Product>(2, 'P-002', 'Carcasa sensor', {
    part_weight_g: 38,
    description: 'Carcasa de sensor de presión',
  }),
  catalog<Product>(3, 'P-003', 'Clip sujetador', { part_weight_g: 4.2, description: '' }),
  catalog<Product>(4, 'P-004', 'Conector 6 vías', {
    part_weight_g: 9.8,
    description: 'Conector automotriz de 6 vías',
  }),
];

const molds: Mold[] = [
  catalog<Mold>(1, 'M-101', 'Molde tapa 4 cavidades', { nominal_cavities: 4 }),
  catalog<Mold>(2, 'M-102', 'Molde carcasa 2 cavidades', { nominal_cavities: 2 }),
  catalog<Mold>(3, 'M-103', 'Molde clip 8 cavidades', { nominal_cavities: 8 }),
  catalog<Mold>(4, 'M-104', 'Molde conector 4 cavidades', { nominal_cavities: 4 }),
];

const resins: Resin[] = [
  catalog<Resin>(1, 'R-PP', 'Polipropileno homopolímero', {
    polymer: 'PP',
    grade: 'H503',
    manufacturer: 'Braskem',
  }),
  catalog<Resin>(2, 'R-ABS', 'ABS natural', {
    polymer: 'ABS',
    grade: 'GP22',
    manufacturer: 'LG Chem',
  }),
];

const employees: Employee[] = [
  catalog<Employee>(1, 'E-001', 'Laura Méndez', { user_id: 2 }),
  catalog<Employee>(2, 'E-002', 'Carlos Ruiz', { user_id: 3 }),
  catalog<Employee>(3, 'E-003', 'Miguel Torres', { user_id: null }),
];

const recipes: Recipe[] = [
  catalog<Recipe>(1, 'RC-001', 'Tapa 40 mm · M-101 · PP', {
    product_id: 1,
    mold_id: 1,
    resin_id: 1,
    ideal_cycle_s: 28,
    active_cavities: 4,
  }),
  catalog<Recipe>(2, 'RC-002', 'Carcasa sensor · M-102 · ABS', {
    product_id: 2,
    mold_id: 2,
    resin_id: 2,
    ideal_cycle_s: 32.5,
    active_cavities: 2,
  }),
  catalog<Recipe>(3, 'RC-003', 'Clip sujetador · M-103 · PP', {
    product_id: 3,
    mold_id: 3,
    resin_id: 1,
    ideal_cycle_s: 24,
    active_cavities: 8,
  }),
  catalog<Recipe>(4, 'RC-004', 'Conector 6 vías · M-104 · ABS', {
    product_id: 4,
    mold_id: 4,
    resin_id: 2,
    ideal_cycle_s: 30,
    active_cavities: 4,
  }),
];

const lots: ResinLot[] = [
  {
    id: 1,
    plant_id: 1,
    resin_id: 1,
    lot_code: 'LOT-PP-2610A',
    received_kg: 500,
    received_at: iso(NOW - 5 * DAY),
  },
  {
    id: 2,
    plant_id: 1,
    resin_id: 2,
    lot_code: 'LOT-ABS-2610A',
    received_kg: 250,
    received_at: iso(NOW - 3 * DAY),
  },
  {
    id: 3,
    plant_id: 1,
    resin_id: 1,
    lot_code: 'LOT-PP-2610B',
    received_kg: 500,
    received_at: iso(NOW - 1 * DAY),
  },
];

const orders: ProductionOrder[] = [
  {
    id: 1,
    plant_id: 1,
    code: 'OP-1001',
    recipe_id: 1,
    target_pieces: 5000,
    status: 'running',
    created_at: iso(NOW - 2 * DAY),
  },
  {
    id: 2,
    plant_id: 1,
    code: 'OP-1002',
    recipe_id: 2,
    target_pieces: 2000,
    status: 'running',
    created_at: iso(NOW - 2 * DAY + HOUR),
  },
  {
    id: 3,
    plant_id: 1,
    code: 'OP-1003',
    recipe_id: 3,
    target_pieces: 12000,
    status: 'running',
    created_at: iso(NOW - 1 * DAY),
  },
  {
    id: 4,
    plant_id: 1,
    code: 'OP-1004',
    recipe_id: 4,
    target_pieces: 4000,
    status: 'running',
    created_at: iso(NOW - 1 * DAY + 2 * HOUR),
  },
  {
    id: 5,
    plant_id: 1,
    code: 'OP-1005',
    recipe_id: 1,
    target_pieces: 3000,
    status: 'planned',
    created_at: iso(NOW - 6 * HOUR),
  },
  {
    id: 6,
    plant_id: 1,
    code: 'OP-0998',
    recipe_id: 3,
    target_pieces: 10000,
    status: 'completed',
    created_at: iso(NOW - 7 * DAY),
  },
  {
    id: 7,
    plant_id: 1,
    code: 'OP-0999',
    recipe_id: 2,
    target_pieces: 800,
    status: 'cancelled',
    created_at: iso(NOW - 6 * DAY),
  },
];

export function contextFor(recipe: Recipe, lineId: number | null): RunContext {
  const product = products.find((item) => item.id === recipe.product_id);
  const mold = molds.find((item) => item.id === recipe.mold_id);
  const resin = resins.find((item) => item.id === recipe.resin_id);
  const line = lineId === null ? undefined : lines.find((item) => item.id === lineId);
  return {
    recipe_id: recipe.id,
    recipe_code: recipe.code,
    product_id: recipe.product_id,
    product_code: product?.code ?? '',
    product_name: product?.name ?? '',
    mold_code: mold?.code ?? '',
    mold_name: mold?.name ?? null,
    resin_id: recipe.resin_id,
    resin_code: resin?.code ?? '',
    resin_name: resin?.name ?? null,
    polymer: resin?.polymer ?? '',
    grade: resin?.grade ?? '',
    counter_unit: 'pieces',
    cycle_unit: 's/shot',
    line_id: line?.id ?? null,
    line_code: line?.code ?? null,
    line_name: line?.name ?? null,
  };
}

function run(
  id: number,
  orderId: number,
  machineId: number,
  recipe: Recipe,
  startedAt: number,
  endedAt: number | null,
): ProductionRun {
  const mold = molds.find((item) => item.id === recipe.mold_id);
  const product = products.find((item) => item.id === recipe.product_id);
  return {
    id,
    plant_id: 1,
    order_id: orderId,
    machine_id: machineId,
    mold_id: recipe.mold_id,
    context: contextFor(recipe, 1),
    nominal_cavities: mold?.nominal_cavities ?? recipe.active_cavities,
    active_cavities: recipe.active_cavities,
    ideal_cycle_s: recipe.ideal_cycle_s,
    part_weight_g: product?.part_weight_g ?? 0,
    started_by: 2,
    ended_by: endedAt === null ? null : 2,
    started_at: iso(startedAt),
    ended_at: endedAt === null ? null : iso(endedAt),
  };
}

const runs: ProductionRun[] = [
  run(1, 6, 3, recipes[2]!, NOW - 6 * DAY, NOW - 3 * DAY),
  run(2, 1, 1, recipes[0]!, NOW - 3 * DAY, NOW - 26 * HOUR),
  run(3, 1, 1, recipes[0]!, NOW - 6 * HOUR, null),
  run(4, 2, 2, recipes[1]!, NOW - 5 * HOUR, null),
  run(5, 3, 3, recipes[2]!, NOW - 4 * HOUR, null),
  run(6, 4, 4, recipes[3]!, NOW - 2 * HOUR, null),
];

const materials: RunMaterial[] = [
  {
    id: 1,
    plant_id: 1,
    run_id: 1,
    resin_lot_id: 1,
    consumed_kg: 300,
    recorded_at: iso(NOW - 4 * DAY),
    recorded_by: 2,
  },
  {
    id: 2,
    plant_id: 1,
    run_id: 3,
    resin_lot_id: 1,
    consumed_kg: 120,
    recorded_at: iso(NOW - 5 * HOUR),
    recorded_by: 2,
  },
  {
    id: 3,
    plant_id: 1,
    run_id: 4,
    resin_lot_id: 2,
    consumed_kg: 40,
    recorded_at: iso(NOW - 4 * HOUR),
    recorded_by: 2,
  },
];

const assignments: RunAssignment[] = [
  {
    id: 1,
    plant_id: 1,
    run_id: 3,
    employee_id: 1,
    role: 'operator',
    started_at: iso(NOW - 6 * HOUR),
    ended_at: null,
  },
  {
    id: 2,
    plant_id: 1,
    run_id: 3,
    employee_id: 3,
    role: 'technician',
    started_at: iso(NOW - 6 * HOUR),
    ended_at: iso(NOW - HOUR),
  },
  {
    id: 3,
    plant_id: 1,
    run_id: 4,
    employee_id: 2,
    role: 'operator',
    started_at: iso(NOW - 5 * HOUR),
    ended_at: null,
  },
];

const downtimes: LineDowntime[] = [
  {
    id: 1,
    plant_id: 1,
    line_id: 1,
    reason_code: '4',
    planned: true,
    comment: 'Cambio de molde programado en la línea',
    started_at: iso(NOW - 2 * DAY - 3 * HOUR),
    ended_at: iso(NOW - 2 * DAY - 2 * HOUR - 20 * 60_000),
    created_by: 2,
    ended_by: 2,
    affected_machine_ids: [1, 2, 3, 4],
  },
];

export const injectionDb = {
  lines,
  machineLines: new Map<number, number>([
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 2],
    [8, 2],
  ]),
  products,
  molds,
  resins,
  employees,
  recipes,
  lots,
  orders,
  runs,
  materials,
  assignments,
  downtimes,
  variables: [
    ...demoVariables(1, 1),
    ...demoVariables(2, 13),
    ...demoVariables(3, 25),
    ...demoVariables(4, 37),
  ] as MachineVariable[],
  ids: {
    line: 3,
    product: 5,
    mold: 5,
    resin: 3,
    employee: 4,
    recipe: 5,
    lot: 4,
    order: 8,
    run: 7,
    material: 4,
    assignment: 4,
    downtime: 2,
    variable: 49,
  },
};

export function lineOf(machineId: number): number | null {
  return injectionDb.machineLines.get(machineId) ?? null;
}

export function runAt(machineId: number, ms: number): ProductionRun | undefined {
  return injectionDb.runs.find(
    (item) =>
      item.machine_id === machineId &&
      new Date(item.started_at).getTime() <= ms &&
      (item.ended_at === null || new Date(item.ended_at).getTime() > ms),
  );
}

export function openRunOf(machineId: number): ProductionRun | undefined {
  return injectionDb.runs.find((item) => item.machine_id === machineId && item.ended_at === null);
}

export function idealSecondsPerPiece(item: ProductionRun): number {
  return item.ideal_cycle_s / Math.max(1, item.active_cavities);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Muestra determinista por máquina y rejilla de 10 s: el mismo instante siempre devuelve lo mismo.
export function sampleAt(machineId: number, ms: number): TelemetrySample {
  const step = Math.floor(ms / TELEMETRY_STEP);
  const stamp = step * TELEMETRY_STEP;
  const rand = mulberry32(machineId * 7919 + step);
  const current = runAt(machineId, stamp);
  const values: Record<string, TelemetryValue> = {};
  const stale = step % 37 === 0;
  const bad = step % 101 === 0;
  const quality: TelemetryQuality = bad ? 'bad' : stale ? 'stale' : 'good';
  for (const variable of injectionDb.variables) {
    if (variable.machine_id !== machineId || !variable.is_active) continue;
    const spec = DEMO_VARIABLES.find((item) => item.code === variable.code);
    let value: number | null;
    if (variable.code === 'shot_count') {
      const since = current ? new Date(current.started_at).getTime() : stamp - 8 * HOUR;
      const cycle = (current?.ideal_cycle_s ?? 30) * 1000;
      value = 1000 * machineId + Math.floor((stamp - since) / cycle);
    } else if (variable.code === 'active_cavities') {
      value = current?.active_cavities ?? 4;
    } else if (spec) {
      value = round(spec.base + (rand() * 2 - 1) * spec.spread, 2);
    } else {
      value = round(variable.offset + variable.scale * (100 + (rand() * 2 - 1) * 5), 2);
    }
    if (bad) value = null;
    values[variable.code] = {
      value,
      unit: variable.unit,
      quality,
      raw: value === null ? null : round((value - variable.offset) / (variable.scale || 1), 3),
      mapping: {
        id: variable.id,
        code: variable.code,
        unit: variable.unit,
        address: variable.address,
        data_type: variable.data_type,
        word_order: variable.word_order,
        byte_order: variable.byte_order,
        scale: variable.scale,
        offset: variable.offset,
        map_version: variable.map_version,
      },
      map_version: variable.map_version,
    };
  }
  return {
    machine_id: machineId,
    sampled_at: iso(stamp),
    run_id: current?.id ?? null,
    source: 'modbus',
    values,
  };
}
