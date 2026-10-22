import type {
  AlertRule,
  AppNotification,
  DowntimeReason,
  Locale,
  MachineState,
  PlantRole,
  Shift,
} from '@/lib/api/types';
import { localParts } from '@/lib/time';

export const MINUTE = 60_000;
export const HISTORY_DAYS = 7;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  password: string;
  language: Locale;
  created_at: string;
}

export interface MockPlant {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  is_public: boolean;
  created_at: string;
}

export interface MockMember {
  plant_id: number;
  user_id: number;
  role: PlantRole;
}

export interface MachineProfile {
  jitter: number;
  scrap: number;
  mtbfMin: number;
  mttrMin: number;
  microStop: number;
  idleProb: number;
  offlineProb: number;
}

export interface MockMachine {
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
  photo_key: string | null;
  created_at: string;
  profile: MachineProfile;
}

export interface Bucket {
  good: number;
  reject: number;
  run_s: number;
  idle_s: number;
  down_s: number;
  offline_s: number;
}

export interface MockEvent {
  id: number;
  machine_id: number;
  state: MachineState;
  reason_code: string | null;
  comment: string | null;
  classified_by: number | null;
  started_at: number;
  ended_at: number | null;
}

export interface MockNotification extends AppNotification {
  user_id: number;
}

export interface Engine {
  state: MachineState;
  segmentStart: number;
  remaining: number;
  alarm: number;
  carry: number;
  goodTotal: number;
  rejectTotal: number;
  lastMinute: number;
  current: Bucket | null;
  rand: () => number;
}

const NOW = Date.now();
const DAY = 86_400_000;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function floorMinute(ms: number): number {
  return Math.floor(ms / MINUTE) * MINUTE;
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DEFAULT_PROFILE: MachineProfile = {
  jitter: 0.08,
  scrap: 0.02,
  mtbfMin: 90,
  mttrMin: 8,
  microStop: 0.04,
  idleProb: 0.006,
  offlineProb: 0.0004,
};

function machine(
  id: number,
  plant_id: number,
  name: string,
  brand: string,
  model: string,
  ideal_cycle_s: number,
  unit_id: number,
  profile: Partial<MachineProfile> = {},
  extra: Partial<Pick<MockMachine, 'host' | 'port' | 'is_active'>> = {},
): MockMachine {
  return {
    id,
    plant_id,
    slug: slugify(name),
    name,
    brand,
    model,
    host: extra.host ?? 'simulator',
    port: extra.port ?? 5020,
    unit_id,
    ideal_cycle_s,
    is_active: extra.is_active ?? true,
    photo_key: null,
    created_at: iso(NOW - 120 * DAY + id * 3_600_000),
    profile: { ...DEFAULT_PROFILE, ...profile },
  };
}

export const db = {
  users: [
    {
      id: 1,
      username: 'demo',
      email: 'demo@oeelive.test',
      full_name: 'Usuario Demo',
      password: 'Demo1234!',
      language: 'es',
      created_at: iso(NOW - 130 * DAY),
    },
    {
      id: 2,
      username: 'lmendez',
      email: 'laura.mendez@oeelive.test',
      full_name: 'Laura Méndez',
      password: 'Super1234',
      language: 'es',
      created_at: iso(NOW - 110 * DAY),
    },
    {
      id: 3,
      username: 'cruiz',
      email: 'carlos.ruiz@oeelive.test',
      full_name: 'Carlos Ruiz',
      password: 'Viewer1234',
      language: 'en',
      created_at: iso(NOW - 90 * DAY),
    },
  ] as MockUser[],
  plants: [
    {
      id: 1,
      slug: 'planta-demo-slp',
      name: 'Planta Demo SLP',
      timezone: 'America/Mexico_City',
      is_public: true,
      created_at: iso(NOW - 125 * DAY),
    },
    {
      id: 2,
      slug: 'planta-norte-mty',
      name: 'Planta Norte MTY',
      timezone: 'America/Monterrey',
      is_public: false,
      created_at: iso(NOW - 40 * DAY),
    },
    {
      id: 3,
      slug: 'taller-escuela-bcn',
      name: 'Taller Escuela BCN',
      timezone: 'Europe/Madrid',
      is_public: true,
      created_at: iso(NOW - 20 * DAY),
    },
  ] as MockPlant[],
  members: [
    { plant_id: 1, user_id: 1, role: 'owner' },
    { plant_id: 1, user_id: 2, role: 'supervisor' },
    { plant_id: 1, user_id: 3, role: 'viewer' },
    { plant_id: 2, user_id: 1, role: 'owner' },
    { plant_id: 3, user_id: 2, role: 'owner' },
    { plant_id: 3, user_id: 1, role: 'viewer' },
  ] as MockMember[],
  machines: [
    machine(1, 1, 'Inyectora 01', 'Engel', 'Victory 330', 28, 1, { mtbfMin: 120, scrap: 0.015 }),
    machine(2, 1, 'Inyectora 02', 'Haitian', 'MA 1600 II', 32.5, 2, {
      mtbfMin: 60,
      mttrMin: 12,
      scrap: 0.03,
    }),
    machine(3, 1, 'Inyectora 03', 'Arburg', 'Allrounder 470 C', 24, 3, { microStop: 0.02 }),
    machine(4, 1, 'Inyectora 04', 'Engel', 'e-mac 180', 30, 4, { idleProb: 0.012, scrap: 0.04 }),
    machine(5, 1, 'Prensa 01', 'Schuler', 'PE 250', 6.5, 5, {
      mtbfMin: 45,
      mttrMin: 6,
      scrap: 0.01,
    }),
    machine(6, 1, 'Prensa 02', 'Aida', 'NC1-110', 5, 6, { mtbfMin: 150, microStop: 0.06 }),
    machine(7, 1, 'CNC 01', 'Fanuc', 'Robodrill D21', 95, 7, { scrap: 0.008, idleProb: 0.004 }),
    machine(8, 1, 'Ensambladora 01', 'Bosch Rexroth', 'TS 2plus', 45, 8, { offlineProb: 0.0012 }),
    machine(
      9,
      2,
      'Extrusora 01',
      'Battenfeld',
      'BEX 45',
      12,
      1,
      { mtbfMin: 200 },
      { host: '10.20.1.15' },
    ),
    machine(
      10,
      2,
      'Prensa 03',
      'Schuler',
      'PE 160',
      7,
      2,
      {},
      { host: '10.20.1.16', is_active: false },
    ),
    machine(
      11,
      3,
      'Torno 01',
      'Haas',
      'ST-10',
      70,
      1,
      { mtbfMin: 80 },
      { host: '192.168.4.21', port: 502 },
    ),
  ] as MockMachine[],
  shifts: [
    {
      id: 1,
      plant_id: 1,
      name: 'Turno 1',
      start_time: '06:00',
      end_time: '14:00',
      days_of_week: [1, 2, 3, 4, 5, 6],
    },
    {
      id: 2,
      plant_id: 1,
      name: 'Turno 2',
      start_time: '14:00',
      end_time: '22:00',
      days_of_week: [1, 2, 3, 4, 5, 6],
    },
    {
      id: 3,
      plant_id: 1,
      name: 'Turno 3',
      start_time: '22:00',
      end_time: '06:00',
      days_of_week: [1, 2, 3, 4, 5],
    },
    {
      id: 4,
      plant_id: 3,
      name: 'Mañana',
      start_time: '07:00',
      end_time: '15:00',
      days_of_week: [1, 2, 3, 4, 5],
    },
  ] as Shift[],
  reasons: [
    { code: '1', label_es: 'Falla mecánica', label_en: 'Mechanical failure', category: 'mecanica' },
    {
      code: '2',
      label_es: 'Falla eléctrica',
      label_en: 'Electrical failure',
      category: 'electrica',
    },
    {
      code: '3',
      label_es: 'Falta de material',
      label_en: 'Material shortage',
      category: 'material',
    },
    { code: '4', label_es: 'Cambio de molde', label_en: 'Mold change', category: 'organizacional' },
    {
      code: '5',
      label_es: 'Ajuste de proceso',
      label_en: 'Process adjustment',
      category: 'calidad',
    },
    {
      code: '6',
      label_es: 'Falta de operador',
      label_en: 'No operator',
      category: 'organizacional',
    },
    {
      code: '7',
      label_es: 'Mantenimiento programado',
      label_en: 'Scheduled maintenance',
      category: 'mecanica',
    },
    { code: '8', label_es: 'Sensor dañado', label_en: 'Sensor fault', category: 'electrica' },
    {
      code: '9',
      label_es: 'Material fuera de especificación',
      label_en: 'Material out of spec',
      category: 'material',
    },
    {
      code: '10',
      label_es: 'Inspección de calidad',
      label_en: 'Quality inspection',
      category: 'calidad',
    },
    { code: '11', label_es: 'Limpieza', label_en: 'Cleaning', category: 'organizacional' },
    { code: '12', label_es: 'Otro', label_en: 'Other', category: 'otro' },
  ] as DowntimeReason[],
  alertRules: [
    {
      id: 1,
      plant_id: 1,
      machine_id: null,
      type: 'MACHINE_DOWN',
      threshold: null,
      duration_s: 300,
      is_active: true,
    },
    {
      id: 2,
      plant_id: 1,
      machine_id: null,
      type: 'MACHINE_OFFLINE',
      threshold: null,
      duration_s: 120,
      is_active: true,
    },
    {
      id: 3,
      plant_id: 1,
      machine_id: 1,
      type: 'OEE_BELOW',
      threshold: 0.6,
      duration_s: 300,
      is_active: true,
    },
  ] as AlertRule[],
  notifications: [
    {
      id: 1,
      user_id: 1,
      type: 'MACHINE_DOWN',
      created_at: iso(NOW - 3 * 3_600_000),
      read_at: null,
      payload: {
        plant_id: 1,
        machine_id: 2,
        machine_name: 'Inyectora 02',
        reason_code: '2',
        duration_s: 420,
      },
    },
    {
      id: 2,
      user_id: 1,
      type: 'OEE_BELOW',
      created_at: iso(NOW - 9 * 3_600_000),
      read_at: null,
      payload: {
        plant_id: 1,
        machine_id: 1,
        machine_name: 'Inyectora 01',
        oee: 0.52,
        threshold: 0.6,
      },
    },
    {
      id: 3,
      user_id: 1,
      type: 'MACHINE_OFFLINE',
      created_at: iso(NOW - 26 * 3_600_000),
      read_at: iso(NOW - 25 * 3_600_000),
      payload: {
        plant_id: 1,
        machine_id: 8,
        machine_name: 'Ensambladora 01',
        reason_code: null,
        duration_s: 180,
      },
    },
  ] as MockNotification[],
  watchlist: [
    { user_id: 1, machine_id: 1 },
    { user_id: 1, machine_id: 3 },
    { user_id: 2, machine_id: 2 },
  ] as Array<{ user_id: number; machine_id: number }>,
  buckets: new Map<number, Map<number, Bucket>>(),
  events: new Map<number, MockEvent[]>(),
  engines: new Map<number, Engine>(),
  photos: new Map<string, Blob>(),
  ids: { user: 4, plant: 4, machine: 12, shift: 5, rule: 4, notification: 4, event: 1 },
};

const COMMENTS = [
  'Se cambió el sensor de puerta',
  'Esperando material del almacén',
  'Ajuste de temperatura en zona 3',
  'Mantenimiento corrigió fuga hidráulica',
  'Operador en capacitación',
  'Limpieza de molde por rebaba',
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isPlanned(plant: MockPlant, ms: number): boolean {
  const shifts = db.shifts.filter((shift) => shift.plant_id === plant.id);
  if (shifts.length === 0) return true;
  const parts = localParts(ms, plant.timezone);
  const minutes = parts.hour * 60 + parts.minute;
  const previousDay = parts.weekday === 1 ? 7 : parts.weekday - 1;
  return shifts.some((shift) => {
    const start = toMinutes(shift.start_time);
    const end = toMinutes(shift.end_time);
    if (start < end) {
      return shift.days_of_week.includes(parts.weekday) && minutes >= start && minutes < end;
    }
    return (
      (shift.days_of_week.includes(parts.weekday) && minutes >= start) ||
      (shift.days_of_week.includes(previousDay) && minutes < end)
    );
  });
}

function plantOf(machine: MockMachine): MockPlant {
  const plant = db.plants.find((item) => item.id === machine.plant_id);
  if (!plant) throw new Error(`plant ${machine.plant_id} missing`);
  return plant;
}

function transition(
  machine: MockMachine,
  engine: Engine,
  state: MachineState,
  at: number,
  alarm = 0,
  live = true,
) {
  const list = db.events.get(machine.id) ?? [];
  const open = list[list.length - 1];
  if (open && open.ended_at === null) open.ended_at = at;
  const event: MockEvent = {
    id: db.ids.event++,
    machine_id: machine.id,
    state,
    reason_code: state === 'DOWN' && alarm > 0 ? String(alarm) : null,
    comment: null,
    classified_by: null,
    started_at: at,
    ended_at: null,
  };
  // En el histórico parte de los paros ya viene clasificada para que la tabla no salga vacía.
  if (!live && state === 'DOWN' && engine.rand() < 0.6) {
    event.comment = COMMENTS[Math.floor(engine.rand() * COMMENTS.length)] ?? null;
    event.classified_by = 2;
  }
  list.push(event);
  db.events.set(machine.id, list);
  engine.state = state;
  engine.segmentStart = at;
  engine.alarm = alarm;
}

function simulateMinute(
  machine: MockMachine,
  engine: Engine,
  minuteStart: number,
  live: boolean,
): Bucket {
  const plant = plantOf(machine);
  const profile = machine.profile;
  const bucket: Bucket = { good: 0, reject: 0, run_s: 0, idle_s: 0, down_s: 0, offline_s: 0 };
  const planned = machine.is_active && isPlanned(plant, minuteStart);

  if (engine.state === 'OFFLINE') {
    engine.remaining -= 1;
    bucket.offline_s = 60;
    if (engine.remaining <= 0) {
      transition(machine, engine, planned ? 'RUNNING' : 'IDLE', minuteStart + MINUTE, 0, live);
    }
    return bucket;
  }

  if (!planned) {
    if (engine.state !== 'IDLE') transition(machine, engine, 'IDLE', minuteStart, 0, live);
    engine.remaining = 0;
    bucket.idle_s = 60;
    return bucket;
  }

  if (engine.remaining > 0) {
    engine.remaining -= 1;
    if (engine.state === 'DOWN') bucket.down_s = 60;
    else bucket.idle_s = 60;
    if (engine.remaining <= 0)
      transition(machine, engine, 'RUNNING', minuteStart + MINUTE, 0, live);
    return bucket;
  }

  if (engine.state !== 'RUNNING') transition(machine, engine, 'RUNNING', minuteStart, 0, live);

  const roll = engine.rand();
  const downProb = 1 / profile.mtbfMin;
  if (roll < downProb) {
    const alarm = 1 + Math.floor(engine.rand() * 12);
    engine.remaining = Math.min(
      90,
      Math.max(1, Math.round(-Math.log(1 - engine.rand()) * profile.mttrMin)),
    );
    transition(machine, engine, 'DOWN', minuteStart, alarm, live);
    bucket.down_s = 60;
    return bucket;
  }
  if (roll < downProb + profile.idleProb) {
    engine.remaining = 4 + Math.floor(engine.rand() * 22);
    transition(machine, engine, 'IDLE', minuteStart, 0, live);
    bucket.idle_s = 60;
    return bucket;
  }
  if (roll < downProb + profile.idleProb + profile.offlineProb) {
    engine.remaining = 3 + Math.floor(engine.rand() * 18);
    transition(machine, engine, 'OFFLINE', minuteStart, 0, live);
    bucket.offline_s = 60;
    return bucket;
  }

  const slow = 1 - profile.microStop * engine.rand() * 2;
  const jitter = 1 + profile.jitter * (engine.rand() - 0.5) * 0.5;
  engine.carry += ((60 / machine.ideal_cycle_s) * slow) / jitter;
  const total = Math.floor(engine.carry);
  engine.carry -= total;
  let reject = 0;
  for (let i = 0; i < total; i += 1) if (engine.rand() < profile.scrap) reject += 1;
  bucket.good = total - reject;
  bucket.reject = reject;
  bucket.run_s = 60;
  return bucket;
}

export function createEngine(machine: MockMachine, startMinute: number): Engine {
  const engine: Engine = {
    state: 'IDLE',
    segmentStart: startMinute,
    remaining: 0,
    alarm: 0,
    carry: 0,
    goodTotal: 100_000 + machine.id * 7_331,
    rejectTotal: 2_000 + machine.id * 137,
    lastMinute: startMinute,
    current: null,
    rand: mulberry32(1_000 + machine.id * 97),
  };
  db.engines.set(machine.id, engine);
  db.buckets.set(machine.id, new Map());
  db.events.set(machine.id, [
    {
      id: db.ids.event++,
      machine_id: machine.id,
      state: 'IDLE',
      reason_code: null,
      comment: null,
      classified_by: null,
      started_at: startMinute,
      ended_at: null,
    },
  ]);
  return engine;
}

const liveStart = floorMinute(NOW);

export function advance(now: number) {
  const target = floorMinute(now);
  const oldest = target - HISTORY_DAYS * DAY;
  for (const machine of db.machines) {
    const engine = db.engines.get(machine.id);
    const buckets = db.buckets.get(machine.id);
    if (!engine || !buckets) continue;
    while (engine.lastMinute < target) {
      if (engine.current) {
        engine.goodTotal += engine.current.good;
        engine.rejectTotal += engine.current.reject;
      }
      const next = engine.lastMinute + MINUTE;
      engine.current = simulateMinute(machine, engine, next, next >= liveStart);
      buckets.set(next, engine.current);
      engine.lastMinute = next;
    }
    for (const key of buckets.keys()) {
      if (key < oldest) buckets.delete(key);
      else break;
    }
  }
}

function seed() {
  const start = floorMinute(NOW) - HISTORY_DAYS * DAY - MINUTE;
  for (const machine of db.machines) createEngine(machine, start);
  advance(NOW);
}

seed();

export function findUser(id: number): MockUser | undefined {
  return db.users.find((user) => user.id === id);
}

export function findPlant(id: number): MockPlant | undefined {
  return db.plants.find((plant) => plant.id === id);
}

export function findMachine(id: number): MockMachine | undefined {
  return db.machines.find((item) => item.id === id);
}

export function machinesOf(plantId: number): MockMachine[] {
  return db.machines
    .filter((item) => item.plant_id === plantId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

export function memberRole(userId: number, plantId: number): PlantRole | null {
  return db.members.find((m) => m.user_id === userId && m.plant_id === plantId)?.role ?? null;
}

export function removeMachine(machineId: number) {
  const machine = findMachine(machineId);
  if (machine?.photo_key) db.photos.delete(machine.photo_key);
  db.machines = db.machines.filter((item) => item.id !== machineId);
  db.engines.delete(machineId);
  db.buckets.delete(machineId);
  db.events.delete(machineId);
  db.watchlist = db.watchlist.filter((item) => item.machine_id !== machineId);
  db.alertRules = db.alertRules.filter((rule) => rule.machine_id !== machineId);
}

export function removePlant(plantId: number) {
  for (const machine of machinesOf(plantId)) removeMachine(machine.id);
  db.plants = db.plants.filter((plant) => plant.id !== plantId);
  db.members = db.members.filter((member) => member.plant_id !== plantId);
  db.shifts = db.shifts.filter((shift) => shift.plant_id !== plantId);
  db.alertRules = db.alertRules.filter((rule) => rule.plant_id !== plantId);
}
