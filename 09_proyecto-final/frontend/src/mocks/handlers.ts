import { delay, http, HttpResponse } from 'msw';
import type {
  AlertRule,
  AlertType,
  Granularity,
  Machine,
  MachineEvent,
  Member,
  OeeMetrics,
  OeeTotals,
  Paginated,
  Photo,
  Plant,
  PlantRole,
  PublicMachine,
  PublicPlantListItem,
  Shift,
  User,
} from '@/lib/api/types';
import { env } from '@/lib/env';
import { isMachineState } from '@/lib/machine-state';
import { isValidTimeZone, localDayKey, parseDayKey, startOfLocalDay } from '@/lib/time';
import { USERNAME_PATTERN } from '@/lib/validation/auth';
import { isHost } from '@/lib/validation/machine';
import {
  advance,
  createEngine,
  db,
  findMachine,
  findPlant,
  findUser,
  floorMinute,
  machinesOf,
  memberRole,
  MINUTE,
  removeMachine,
  removePlant,
  slugify,
  type MockEvent,
  type MockMachine,
  type MockPlant,
  type MockUser,
} from './data';
import { createInjectionHandlers, idealSecondsFor, machineLineId } from './injection';
import { createBoardHandlers } from './board';
import { refreshJar } from './jar';
import {
  dayWindow,
  nextLocalDay,
  series,
  snapshotFor,
  summary,
  todayWindow,
  windowTotals,
} from './oee';

class Reply {
  constructor(readonly response: Response) {}
}

function fail(status: number, code: string, field?: string): never {
  throw new Reply(HttpResponse.json({ error: field ? { code, field } : { code } }, { status }));
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Resolver = (info: {
  request: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

const api = (path: string) => `*/api/v1${path}`;

function handle(method: Method, path: string, resolver: Resolver) {
  return http[method](api(path), async ({ request, params }) => {
    await delay(120 + Math.random() * 180);
    try {
      return await resolver({ request, params: params as Record<string, string> });
    } catch (error) {
      if (error instanceof Reply) return error.response;
      throw error;
    }
  });
}

type Body = Record<string, unknown>;

async function readBody(request: Request): Promise<Body> {
  try {
    const parsed: unknown = await request.json();
    return parsed && typeof parsed === 'object' ? (parsed as Body) : {};
  } catch {
    return {};
  }
}

function str(body: Body, field: string, min: number, max: number): string {
  const value = body[field];
  if (typeof value !== 'string') fail(422, 'VALIDATION_ERROR', field);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) fail(422, 'VALIDATION_ERROR', field);
  return trimmed;
}

function optionalStr(body: Body, field: string, min: number, max: number): string | undefined {
  return body[field] === undefined ? undefined : str(body, field, min, max);
}

function int(body: Body, field: string, min: number, max: number): number {
  const value = body[field];
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max)
    fail(422, 'VALIDATION_ERROR', field);
  return parsed;
}

function num(body: Body, field: string, min: number, max: number): number {
  const value = body[field];
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max)
    fail(422, 'VALIDATION_ERROR', field);
  return parsed;
}

function bool(body: Body, field: string, fallback?: boolean): boolean {
  const value = body[field];
  if (typeof value === 'boolean') return value;
  if (value === undefined && fallback !== undefined) return fallback;
  fail(422, 'VALIDATION_ERROR', field);
}

function idParam(params: Record<string, string>, name: string): number {
  const value = Number(params[name]);
  if (!Number.isInteger(value)) fail(404, 'NOT_FOUND');
  return value;
}

function paginate<T>(items: T[], url: URL): Paginated<T> {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('page_size') ?? '20', 10) || 20),
  );
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total: items.length,
    has_next: page * pageSize < items.length,
    has_prev: page > 1 && items.length > 0,
  };
}

function parseInstant(value: string | null, field: string): number {
  if (!value || !/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) fail(422, 'VALIDATION_ERROR', field);
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) fail(422, 'VALIDATION_ERROR', field);
  return ms;
}

function parseWindow(url: URL): [number, number] {
  const from = parseInstant(url.searchParams.get('from'), 'from');
  const to = parseInstant(url.searchParams.get('to'), 'to');
  if (from >= to) fail(422, 'VALIDATION_ERROR', 'to');
  return [from, to];
}

const ACCESS_TTL = 15 * MINUTE;
const ROLES: PlantRole[] = ['owner', 'supervisor', 'viewer'];
const ALERT_TYPES: AlertType[] = ['MACHINE_DOWN', 'MACHINE_OFFLINE', 'OEE_BELOW'];
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function issueAccess(user: MockUser): string {
  return `mock.${user.id}.${Date.now() + ACCESS_TTL}`;
}

function issueRefresh(user: MockUser) {
  refreshJar.set(`refresh.${user.id}.${Math.random().toString(36).slice(2)}`);
}

function toUser(user: MockUser): User {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    language: user.language,
    created_at: user.created_at,
  };
}

function currentUser(request: Request): MockUser {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer mock\.(\d+)\.(\d+)$/.exec(header);
  const id = match?.[1];
  const expires = match?.[2];
  if (!id || !expires || Number(expires) < Date.now()) fail(401, 'NOT_AUTHENTICATED');
  const user = findUser(Number(id));
  if (!user) fail(401, 'NOT_AUTHENTICATED');
  return user;
}

function requireMembership(
  user: MockUser,
  plantId: number,
  roles?: PlantRole[],
): { plant: MockPlant; role: PlantRole } {
  const plant = findPlant(plantId);
  const role = plant ? memberRole(user.id, plant.id) : null;
  if (!plant || !role) fail(404, 'NOT_FOUND');
  if (roles && !roles.includes(role)) fail(403, 'FORBIDDEN');
  return { plant, role };
}

function requireMachine(user: MockUser, machineId: number, roles?: PlantRole[]) {
  const machine = findMachine(machineId);
  if (!machine) fail(404, 'NOT_FOUND');
  const { plant, role } = requireMembership(user, machine.plant_id, roles);
  return { machine, plant, role };
}

function metricsOnly(totals: OeeTotals): OeeMetrics {
  return {
    availability: totals.availability,
    performance: totals.performance,
    quality: totals.quality,
    oee: totals.oee,
  };
}

function photoOf(machine: MockMachine): Photo | null {
  if (!machine.photo_key) return null;
  const base = `/api/v1/media/machines/${machine.photo_key}`;
  return { sm: `${base}_320.webp`, md: `${base}_768.webp`, lg: `${base}_1280.webp` };
}

function plantOeeToday(plant: MockPlant, now: number): OeeMetrics {
  const [from, to] = todayWindow(plant, now);
  return metricsOnly(summary(plant, machinesOf(plant.id), from, to).plant);
}

function toPlant(plant: MockPlant, role: PlantRole, now: number): Plant {
  return {
    id: plant.id,
    slug: plant.slug,
    name: plant.name,
    timezone: plant.timezone,
    is_public: plant.is_public,
    role,
    created_at: plant.created_at,
    machine_count: machinesOf(plant.id).length,
    oee_today: plantOeeToday(plant, now),
  };
}

function toPublicPlant(plant: MockPlant, now: number): PublicPlantListItem {
  return {
    id: plant.id,
    slug: plant.slug,
    name: plant.name,
    timezone: plant.timezone,
    machine_count: machinesOf(plant.id).length,
    oee_today: plantOeeToday(plant, now),
    created_at: plant.created_at,
  };
}

function toPublicMachine(machine: MockMachine, plant: MockPlant, now: number): PublicMachine {
  return {
    id: machine.id,
    slug: machine.slug,
    name: machine.name,
    brand: machine.brand,
    model: machine.model,
    photo: photoOf(machine),
    snapshot: snapshotFor(machine, plant, now),
  };
}

function toMachine(machine: MockMachine, plant: MockPlant, user: MockUser, now: number): Machine {
  return {
    ...toPublicMachine(machine, plant, now),
    plant_id: machine.plant_id,
    host: machine.host,
    port: machine.port,
    unit_id: machine.unit_id,
    ideal_cycle_s: machine.ideal_cycle_s,
    is_active: machine.is_active,
    is_watched: db.watchlist.some(
      (item) => item.user_id === user.id && item.machine_id === machine.id,
    ),
    line_id: machineLineId(machine.id),
    created_at: machine.created_at,
  };
}

function toMember(member: { user_id: number; role: PlantRole }): Member {
  const user = findUser(member.user_id);
  return {
    user_id: member.user_id,
    username: user?.username ?? '',
    full_name: user?.full_name ?? '',
    role: member.role,
  };
}

function toEvent(event: MockEvent): MachineEvent {
  const classifier = event.classified_by === null ? null : findUser(event.classified_by);
  return {
    id: event.id,
    machine_id: event.machine_id,
    state: event.state,
    reason_code: event.reason_code,
    reason: db.reasons.find((reason) => reason.code === event.reason_code) ?? null,
    comment: event.comment,
    classified_by: classifier ? { id: classifier.id, username: classifier.username } : null,
    started_at: new Date(event.started_at).toISOString(),
    ended_at: event.ended_at === null ? null : new Date(event.ended_at).toISOString(),
  };
}

function reachable(host: string, port: number, unitId: number): boolean {
  const knownHost =
    ['simulator', 'localhost', '127.0.0.1'].includes(host) || /^(10|192\.168)\./.test(host);
  return knownHost && [502, 5020].includes(port) && unitId >= 1 && unitId <= 8;
}

function registersFor(machine: MockMachine | null, idealCycle: number, now: number) {
  const engine = machine ? db.engines.get(machine.id) : undefined;
  const stateCode = engine?.state === 'RUNNING' ? 1 : engine?.state === 'DOWN' ? 2 : 0;
  return {
    state: stateCode,
    good_count: engine?.goodTotal ?? 0,
    reject_count: engine?.rejectTotal ?? 0,
    alarm_code: engine?.state === 'DOWN' ? engine.alarm : 0,
    last_cycle_ds: Math.round(idealCycle * 10 * (1 + ((now % 7) - 3) / 100)),
    heartbeat: Math.floor(now / 1000) % 65536,
    ideal_cycle_ds: Math.round(idealCycle * 10),
  };
}

function connectionResponse(
  machine: MockMachine | null,
  host: string,
  port: number,
  unitId: number,
  idealCycle: number,
) {
  if (!reachable(host, port, unitId)) fail(502, 'MODBUS_UNREACHABLE');
  const now = Date.now();
  return HttpResponse.json({
    ok: true,
    latency_ms: 3 + Math.round(Math.random() * 18),
    registers: registersFor(machine, idealCycle, now),
  });
}

function csvCell(value: number | null): string {
  return value === null ? '' : value.toFixed(4);
}

function csvText(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvFor(plant: MockPlant, machines: MockMachine[], from: number, to: number): string {
  const lines = [
    'date,machine,availability,performance,quality,oee,good,reject,run_s,planned_s,ideal_seconds',
  ];
  let day = startOfLocalDay(from, plant.timezone).getTime();
  while (day < to) {
    const end = Math.min(nextLocalDay(day, plant.timezone), to);
    const start = Math.max(day, from);
    for (const machine of machines) {
      const totals = windowTotals(machine, plant, start, end);
      // Con corrida vigente el tiempo ideal sale por pieza según sus cavidades; sin corrida queda vacío.
      const perPiece = idealSecondsFor(machine.id, end - 1) ?? machine.ideal_cycle_s;
      const idealSeconds = perPiece * (totals.good + totals.reject);
      lines.push(
        [
          localDayKey(day, plant.timezone),
          csvText(machine.name),
          csvCell(totals.availability),
          csvCell(totals.performance),
          csvCell(totals.quality),
          csvCell(totals.oee),
          totals.good,
          totals.reject,
          totals.run_s,
          totals.planned_s,
          idealSeconds === null ? '' : idealSeconds.toFixed(1),
        ].join(','),
      );
    }
    day = nextLocalDay(day, plant.timezone);
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

function compactStamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function placeholderSvg(label: string): string {
  const text = label.replace(/[<>&]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#161c26"/><g fill="none" stroke="#5b93ff" stroke-width="6" stroke-linejoin="round"><path d="M80 320V140l110 70V140l110 70V110h120v210Z"/><path d="M120 320v-40h40v40M300 320v-40h40v40"/><circle cx="420" cy="200" r="28"/></g><text x="40" y="380" fill="#9aa3b2" font-family="monospace" font-size="28">${text}</text></svg>`;
}

function validatePassword(body: Body, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    fail(422, 'VALIDATION_ERROR', field);
  }
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) fail(422, 'VALIDATION_ERROR', field);
  return value;
}

function validateEmail(body: Body, field: string): string {
  const value = str(body, field, 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail(422, 'VALIDATION_ERROR', field);
  return value;
}

function validateUsername(body: Body, field: string): string {
  const value = str(body, field, 3, 30);
  if (!USERNAME_PATTERN.test(value)) fail(422, 'VALIDATION_ERROR', field);
  return value;
}

function usernameTaken(username: string, exceptId?: number): boolean {
  return db.users.some((user) => user.username === username && user.id !== exceptId);
}

function emailTaken(email: string, exceptId?: number): boolean {
  return db.users.some((user) => user.email.toLowerCase() === email && user.id !== exceptId);
}

function ownersOf(plantId: number): number[] {
  return db.members
    .filter((m) => m.plant_id === plantId && m.role === 'owner')
    .map((m) => m.user_id);
}

type ShiftInput = Partial<Omit<Shift, 'id' | 'plant_id'>>;

function validateShift(body: Body, partial: boolean): ShiftInput {
  const result: ShiftInput = {};
  const name = partial ? optionalStr(body, 'name', 1, 40) : str(body, 'name', 1, 40);
  if (name !== undefined) result.name = name;
  for (const field of ['start_time', 'end_time'] as const) {
    const value = body[field];
    if (value === undefined && partial) continue;
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      fail(422, 'VALIDATION_ERROR', field);
    }
    result[field] = value;
  }
  const days = body.days_of_week;
  if (days !== undefined || !partial) {
    if (!Array.isArray(days) || days.length === 0) fail(422, 'VALIDATION_ERROR', 'days_of_week');
    const unique = [...new Set(days.map(Number))].sort((a, b) => a - b);
    if (
      unique.length !== days.length ||
      unique.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
    ) {
      fail(422, 'VALIDATION_ERROR', 'days_of_week');
    }
    result.days_of_week = unique;
  }
  return result;
}

type RuleInput = Partial<Omit<AlertRule, 'id' | 'plant_id'>>;

function validateRule(body: Body, plant: MockPlant, partial: boolean): RuleInput {
  const result: RuleInput = {};
  const type = body.type;
  if (type !== undefined || !partial) {
    if (typeof type !== 'string' || !ALERT_TYPES.includes(type as AlertType)) {
      fail(422, 'VALIDATION_ERROR', 'type');
    }
    result.type = type as AlertType;
  }
  if (body.machine_id !== undefined || !partial) {
    if (body.machine_id === null || body.machine_id === undefined) result.machine_id = null;
    else {
      const machineId = int(body, 'machine_id', 1, Number.MAX_SAFE_INTEGER);
      if (!machinesOf(plant.id).some((m) => m.id === machineId)) {
        fail(422, 'VALIDATION_ERROR', 'machine_id');
      }
      result.machine_id = machineId;
    }
  }
  if (body.duration_s !== undefined || !partial)
    result.duration_s = int(body, 'duration_s', 30, 86_400);
  if (body.is_active !== undefined || !partial) result.is_active = bool(body, 'is_active', true);
  if (body.threshold !== undefined || !partial) {
    result.threshold =
      body.threshold === null || body.threshold === undefined ? null : num(body, 'threshold', 0, 1);
  }
  return result;
}

type MachineInputFields = Partial<
  Pick<
    MockMachine,
    'name' | 'brand' | 'model' | 'host' | 'port' | 'unit_id' | 'ideal_cycle_s' | 'is_active'
  >
>;

function validateMachineInput(body: Body, partial: boolean): MachineInputFields {
  const result: MachineInputFields = {};
  const name = partial ? optionalStr(body, 'name', 2, 60) : str(body, 'name', 2, 60);
  if (name !== undefined) result.name = name;
  const brand = partial ? optionalStr(body, 'brand', 0, 40) : str(body, 'brand', 0, 40);
  if (brand !== undefined) result.brand = brand;
  const model = partial ? optionalStr(body, 'model', 0, 40) : str(body, 'model', 0, 40);
  if (model !== undefined) result.model = model;
  const host = partial ? optionalStr(body, 'host', 1, 253) : str(body, 'host', 1, 253);
  if (host !== undefined) {
    if (!isHost(host)) fail(422, 'VALIDATION_ERROR', 'host');
    result.host = host;
  }
  if (body.port !== undefined || !partial) result.port = int(body, 'port', 1, 65535);
  if (body.unit_id !== undefined || !partial) result.unit_id = int(body, 'unit_id', 1, 247);
  if (body.ideal_cycle_s !== undefined || !partial) {
    const cycle = num(body, 'ideal_cycle_s', 0.1, 3600);
    if (Math.abs(cycle * 10 - Math.round(cycle * 10)) > 1e-9) {
      fail(422, 'VALIDATION_ERROR', 'ideal_cycle_s');
    }
    result.ideal_cycle_s = cycle;
  }
  if (body.is_active !== undefined || !partial) result.is_active = bool(body, 'is_active', true);
  return result;
}

function findEvent(eventId: number): MockEvent | undefined {
  for (const list of db.events.values()) {
    const found = list.find((event) => event.id === eventId);
    if (found) return found;
  }
  return undefined;
}

function noContent() {
  return new HttpResponse(null, { status: 204 });
}

// Los handlers de inyección viven aparte y reciben estas utilidades para no importar en círculo.
const mockTools = {
  handle,
  fail,
  readBody,
  str,
  optionalStr,
  int,
  num,
  bool,
  idParam,
  paginate,
  parseInstant,
  currentUser,
  requireMembership,
  requireMachine,
  plantOeeToday,
};

export type MockTools = typeof mockTools;

const baseHandlers = [
  handle('post', '/auth/register', async ({ request }) => {
    const body = await readBody(request);
    const username = validateUsername(body, 'username');
    const email = validateEmail(body, 'email');
    const fullName = str(body, 'full_name', 2, 80);
    const password = validatePassword(body, 'password');
    const language = body.language;
    if (language !== 'es' && language !== 'en') fail(422, 'VALIDATION_ERROR', 'language');
    if (usernameTaken(username)) fail(409, 'USERNAME_TAKEN', 'username');
    if (emailTaken(email)) fail(409, 'EMAIL_TAKEN', 'email');
    const user: MockUser = {
      id: db.ids.user++,
      username,
      email,
      full_name: fullName,
      password,
      language,
      created_at: new Date().toISOString(),
    };
    db.users.push(user);
    issueRefresh(user);
    return HttpResponse.json(
      { user: toUser(user), access_token: issueAccess(user) },
      { status: 201 },
    );
  }),

  handle('post', '/auth/login', async ({ request }) => {
    const body = await readBody(request);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const user = db.users.find((item) => item.username === username);
    if (!user || user.password !== password) fail(401, 'INVALID_CREDENTIALS');
    issueRefresh(user);
    return HttpResponse.json({ user: toUser(user), access_token: issueAccess(user) });
  }),

  handle('post', '/auth/refresh', () => {
    const token = refreshJar.get();
    const match = token ? /^refresh\.(\d+)\./.exec(token) : null;
    const user = match?.[1] ? findUser(Number(match[1])) : undefined;
    if (!user) {
      refreshJar.clear();
      fail(401, 'INVALID_TOKEN');
    }
    issueRefresh(user);
    return HttpResponse.json({ access_token: issueAccess(user) });
  }),

  handle('post', '/auth/logout', () => {
    refreshJar.clear();
    return noContent();
  }),

  handle('post', '/auth/password/forgot', () => noContent()),

  handle('post', '/auth/password/reset', async ({ request }) => {
    const body = await readBody(request);
    const token = typeof body.token === 'string' ? body.token : '';
    const match = /^reset\.(\d+)$/.exec(token);
    const user = match?.[1] ? findUser(Number(match[1])) : undefined;
    if (!user) fail(400, 'INVALID_TOKEN');
    user.password = validatePassword(body, 'new_password');
    return noContent();
  }),

  handle('get', '/auth/availability', ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get('username');
    const email = url.searchParams.get('email')?.toLowerCase();
    return HttpResponse.json({
      username_available: username ? !usernameTaken(username) : true,
      email_available: email ? !emailTaken(email) : true,
    });
  }),

  handle('get', '/me', ({ request }) => HttpResponse.json(toUser(currentUser(request)))),

  handle('patch', '/me', async ({ request }) => {
    const user = currentUser(request);
    const body = await readBody(request);
    const username = body.username === undefined ? undefined : validateUsername(body, 'username');
    const email = body.email === undefined ? undefined : validateEmail(body, 'email');
    const fullName = optionalStr(body, 'full_name', 2, 80);
    if (body.language !== undefined && body.language !== 'es' && body.language !== 'en') {
      fail(422, 'VALIDATION_ERROR', 'language');
    }
    if (username && usernameTaken(username, user.id)) fail(409, 'USERNAME_TAKEN', 'username');
    if (email && emailTaken(email, user.id)) fail(409, 'EMAIL_TAKEN', 'email');
    if (username) user.username = username;
    if (email) user.email = email;
    if (fullName) user.full_name = fullName;
    if (body.language === 'es' || body.language === 'en') user.language = body.language;
    return HttpResponse.json(toUser(user));
  }),

  handle('put', '/me/password', async ({ request }) => {
    const user = currentUser(request);
    const body = await readBody(request);
    if (body.current_password !== user.password) fail(400, 'WRONG_PASSWORD', 'current_password');
    user.password = validatePassword(body, 'new_password');
    return noContent();
  }),

  handle('delete', '/me', async ({ request }) => {
    const user = currentUser(request);
    const body = await readBody(request);
    if (body.password !== user.password) fail(400, 'WRONG_PASSWORD', 'password');
    for (const plant of [...db.plants]) {
      const owners = ownersOf(plant.id);
      if (owners.length === 1 && owners[0] === user.id) removePlant(plant.id);
    }
    db.members = db.members.filter((member) => member.user_id !== user.id);
    db.watchlist = db.watchlist.filter((item) => item.user_id !== user.id);
    db.notifications = db.notifications.filter((item) => item.user_id !== user.id);
    db.users = db.users.filter((item) => item.id !== user.id);
    refreshJar.clear();
    return noContent();
  }),

  handle('get', '/public/plants', ({ request }) => {
    const now = Date.now();
    const plants = db.plants
      .filter((plant) => plant.is_public)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .map((plant) => toPublicPlant(plant, now));
    return HttpResponse.json(paginate(plants, new URL(request.url)));
  }),

  handle('get', '/public/plants/:slug', ({ params }) => {
    const plant = db.plants.find((item) => item.slug === params.slug && item.is_public);
    if (!plant) fail(404, 'NOT_FOUND');
    const now = Date.now();
    return HttpResponse.json({
      id: plant.id,
      slug: plant.slug,
      name: plant.name,
      timezone: plant.timezone,
      oee_today: plantOeeToday(plant, now),
      machines: machinesOf(plant.id).map((machine) => toPublicMachine(machine, plant, now)),
    });
  }),

  handle('get', '/public/plants/:slug/machines/:machineSlug', ({ params }) => {
    const plant = db.plants.find((item) => item.slug === params.slug && item.is_public);
    const machine = plant
      ? machinesOf(plant.id).find((item) => item.slug === params.machineSlug)
      : undefined;
    if (!plant || !machine) fail(404, 'NOT_FOUND');
    const now = Date.now();
    const to = floorMinute(now);
    return HttpResponse.json({
      ...toPublicMachine(machine, plant, now),
      ideal_cycle_s: machine.ideal_cycle_s,
      plant: { id: plant.id, slug: plant.slug, name: plant.name, timezone: plant.timezone },
      trend: series(machine, plant, to - 12 * 3_600_000, to, 'hour'),
    });
  }),

  handle('get', '/plants', ({ request }) => {
    const user = currentUser(request);
    const now = Date.now();
    const plants = db.members
      .filter((member) => member.user_id === user.id)
      .flatMap((member) => {
        const plant = findPlant(member.plant_id);
        return plant ? [toPlant(plant, member.role, now)] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    return HttpResponse.json(paginate(plants, new URL(request.url)));
  }),

  handle('post', '/plants', async ({ request }) => {
    const user = currentUser(request);
    const body = await readBody(request);
    const name = str(body, 'name', 2, 80);
    const timezone = str(body, 'timezone', 1, 64);
    if (!isValidTimeZone(timezone)) fail(422, 'VALIDATION_ERROR', 'timezone');
    const isPublic = bool(body, 'is_public', false);
    const slug = slugify(name);
    if (!slug || db.plants.some((plant) => plant.slug === slug)) fail(409, 'SLUG_TAKEN', 'name');
    const plant: MockPlant = {
      id: db.ids.plant++,
      slug,
      name,
      timezone,
      is_public: isPublic,
      created_at: new Date().toISOString(),
    };
    db.plants.push(plant);
    db.members.push({ plant_id: plant.id, user_id: user.id, role: 'owner' });
    return HttpResponse.json(toPlant(plant, 'owner', Date.now()), { status: 201 });
  }),

  handle('get', '/plants/:id', ({ request, params }) => {
    const user = currentUser(request);
    const { plant, role } = requireMembership(user, idParam(params, 'id'));
    return HttpResponse.json(toPlant(plant, role, Date.now()));
  }),

  handle('patch', '/plants/:id', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant, role } = requireMembership(user, idParam(params, 'id'), ['owner']);
    const body = await readBody(request);
    const name = optionalStr(body, 'name', 2, 80);
    const timezone = optionalStr(body, 'timezone', 1, 64);
    if (timezone !== undefined && !isValidTimeZone(timezone)) {
      fail(422, 'VALIDATION_ERROR', 'timezone');
    }
    if (body.is_public !== undefined) plant.is_public = bool(body, 'is_public');
    if (name !== undefined) plant.name = name;
    if (timezone !== undefined) plant.timezone = timezone;
    return HttpResponse.json(toPlant(plant, role, Date.now()));
  }),

  handle('delete', '/plants/:id', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner']);
    removePlant(plant.id);
    return noContent();
  }),

  handle('get', '/plants/:id/members', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const members = db.members
      .filter((member) => member.plant_id === plant.id)
      .map(toMember)
      .sort((a, b) => a.username.localeCompare(b.username));
    return HttpResponse.json(paginate(members, new URL(request.url)));
  }),

  handle('post', '/plants/:id/members', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner']);
    const body = await readBody(request);
    const username = str(body, 'username', 1, 30);
    const role = body.role;
    if (typeof role !== 'string' || !ROLES.includes(role as PlantRole)) {
      fail(422, 'VALIDATION_ERROR', 'role');
    }
    const target = db.users.find((item) => item.username === username);
    if (!target) fail(404, 'NOT_FOUND', 'username');
    if (memberRole(target.id, plant.id)) fail(422, 'VALIDATION_ERROR', 'username');
    const member = { plant_id: plant.id, user_id: target.id, role: role as PlantRole };
    db.members.push(member);
    return HttpResponse.json(toMember(member), { status: 201 });
  }),

  handle('patch', '/plants/:id/members/:userId', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner']);
    const userId = idParam(params, 'userId');
    const member = db.members.find((m) => m.plant_id === plant.id && m.user_id === userId);
    if (!member) fail(404, 'NOT_FOUND');
    const body = await readBody(request);
    const role = body.role;
    if (typeof role !== 'string' || !ROLES.includes(role as PlantRole)) {
      fail(422, 'VALIDATION_ERROR', 'role');
    }
    if (member.role === 'owner' && role !== 'owner' && ownersOf(plant.id).length === 1) {
      fail(403, 'FORBIDDEN');
    }
    member.role = role as PlantRole;
    return HttpResponse.json(toMember(member));
  }),

  handle('delete', '/plants/:id/members/:userId', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner']);
    const userId = idParam(params, 'userId');
    const member = db.members.find((m) => m.plant_id === plant.id && m.user_id === userId);
    if (!member) fail(404, 'NOT_FOUND');
    if (member.role === 'owner' && ownersOf(plant.id).length === 1) fail(403, 'FORBIDDEN');
    db.members = db.members.filter((m) => m !== member);
    const plantMachines = machinesOf(plant.id).map((m) => m.id);
    db.watchlist = db.watchlist.filter(
      (item) => !(item.user_id === userId && plantMachines.includes(item.machine_id)),
    );
    return noContent();
  }),

  handle('get', '/plants/:id/machines', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const url = new URL(request.url);
    const now = Date.now();
    const search = url.searchParams.get('search')?.trim().toLowerCase();
    const brand = url.searchParams.get('brand');
    const state = url.searchParams.get('state');
    if (state && !isMachineState(state)) fail(422, 'VALIDATION_ERROR', 'state');
    const machines = machinesOf(plant.id)
      .map((machine) => toMachine(machine, plant, user, now))
      .filter((machine) => !search || machine.name.toLowerCase().includes(search))
      .filter((machine) => !brand || machine.brand === brand)
      .filter((machine) => !state || machine.snapshot.state === state);
    return HttpResponse.json(paginate(machines, url));
  }),

  handle('post', '/plants/:id/machines', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const input = validateMachineInput(await readBody(request), false);
    const slug = slugify(input.name ?? '');
    if (!slug || machinesOf(plant.id).some((m) => m.slug === slug)) fail(409, 'SLUG_TAKEN', 'name');
    const machine: MockMachine = {
      id: db.ids.machine++,
      plant_id: plant.id,
      slug,
      name: input.name ?? '',
      brand: input.brand ?? '',
      model: input.model ?? '',
      host: input.host ?? '',
      port: input.port ?? 502,
      unit_id: input.unit_id ?? 1,
      ideal_cycle_s: input.ideal_cycle_s ?? 30,
      is_active: input.is_active ?? true,
      photo_key: null,
      created_at: new Date().toISOString(),
      profile: {
        jitter: 0.08,
        scrap: 0.02,
        mtbfMin: 90,
        mttrMin: 8,
        microStop: 0.04,
        idleProb: 0.006,
        offlineProb: 0.0004,
      },
    };
    db.machines.push(machine);
    // Solo las máquinas que el simulador "alcanza" cobran vida; las demás quedan OFFLINE, como con el colector real.
    if (reachable(machine.host, machine.port, machine.unit_id)) {
      createEngine(machine, floorMinute(Date.now()) - MINUTE);
      advance(Date.now());
    }
    return HttpResponse.json(toMachine(machine, plant, user, Date.now()), { status: 201 });
  }),

  handle('post', '/plants/:id/machines/test-connection', async ({ request, params }) => {
    const user = currentUser(request);
    requireMembership(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const body = await readBody(request);
    const host = str(body, 'host', 1, 253);
    if (!isHost(host)) fail(422, 'VALIDATION_ERROR', 'host');
    const port = int(body, 'port', 1, 65535);
    const unitId = int(body, 'unit_id', 1, 247);
    const twin =
      db.machines.find((m) => m.host === host && m.port === port && m.unit_id === unitId) ?? null;
    return connectionResponse(twin, host, port, unitId, twin?.ideal_cycle_s ?? 30);
  }),

  handle('get', '/machines/:id', ({ request, params }) => {
    const user = currentUser(request);
    const { machine, plant } = requireMachine(user, idParam(params, 'id'));
    return HttpResponse.json(toMachine(machine, plant, user, Date.now()));
  }),

  handle('patch', '/machines/:id', async ({ request, params }) => {
    const user = currentUser(request);
    const { machine, plant } = requireMachine(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const input = validateMachineInput(await readBody(request), true);
    Object.assign(machine, input);
    return HttpResponse.json(toMachine(machine, plant, user, Date.now()));
  }),

  handle('delete', '/machines/:id', ({ request, params }) => {
    const user = currentUser(request);
    const { machine } = requireMachine(user, idParam(params, 'id'), ['owner', 'supervisor']);
    removeMachine(machine.id);
    return noContent();
  }),

  handle('post', '/machines/:id/photo', async ({ request, params }) => {
    const user = currentUser(request);
    const { machine, plant } = requireMachine(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof Blob)) fail(422, 'VALIDATION_ERROR', 'file');
    if (!PHOTO_TYPES.includes(file.type)) fail(415, 'UNSUPPORTED_FILE', 'file');
    if (file.size > PHOTO_MAX_BYTES) fail(413, 'FILE_TOO_LARGE', 'file');
    if (machine.photo_key) db.photos.delete(machine.photo_key);
    machine.photo_key = `${machine.slug}-${Date.now().toString(36)}`;
    db.photos.set(machine.photo_key, file);
    return HttpResponse.json(toMachine(machine, plant, user, Date.now()));
  }),

  handle('post', '/machines/:id/test-connection', ({ request, params }) => {
    const user = currentUser(request);
    const { machine } = requireMachine(user, idParam(params, 'id'), ['owner', 'supervisor']);
    return connectionResponse(
      machine,
      machine.host,
      machine.port,
      machine.unit_id,
      machine.ideal_cycle_s,
    );
  }),

  handle('get', '/plants/:id/shifts', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const shifts = db.shifts
      .filter((shift) => shift.plant_id === plant.id)
      .sort((a, b) => a.start_time.localeCompare(b.start_time) || a.id - b.id);
    return HttpResponse.json(paginate(shifts, new URL(request.url)));
  }),

  handle('post', '/plants/:id/shifts', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const input = validateShift(await readBody(request), false);
    if (input.start_time === input.end_time) fail(422, 'VALIDATION_ERROR', 'end_time');
    const shift: Shift = {
      id: db.ids.shift++,
      plant_id: plant.id,
      name: input.name ?? '',
      start_time: input.start_time ?? '00:00',
      end_time: input.end_time ?? '00:00',
      days_of_week: input.days_of_week ?? [],
    };
    db.shifts.push(shift);
    return HttpResponse.json(shift, { status: 201 });
  }),

  handle('patch', '/shifts/:id', async ({ request, params }) => {
    const user = currentUser(request);
    const shift = db.shifts.find((item) => item.id === idParam(params, 'id'));
    if (!shift) fail(404, 'NOT_FOUND');
    requireMembership(user, shift.plant_id, ['owner', 'supervisor']);
    const input = validateShift(await readBody(request), true);
    const next = { ...shift, ...input };
    if (next.start_time === next.end_time) fail(422, 'VALIDATION_ERROR', 'end_time');
    Object.assign(shift, input);
    return HttpResponse.json(shift);
  }),

  handle('delete', '/shifts/:id', ({ request, params }) => {
    const user = currentUser(request);
    const shift = db.shifts.find((item) => item.id === idParam(params, 'id'));
    if (!shift) fail(404, 'NOT_FOUND');
    requireMembership(user, shift.plant_id, ['owner', 'supervisor']);
    db.shifts = db.shifts.filter((item) => item !== shift);
    return noContent();
  }),

  handle('get', '/machines/:id/oee', ({ request, params }) => {
    const user = currentUser(request);
    const { machine, plant } = requireMachine(user, idParam(params, 'id'));
    const url = new URL(request.url);
    const [from, to] = parseWindow(url);
    const granularity = url.searchParams.get('granularity') ?? 'hour';
    if (!['hour', 'shift', 'day'].includes(granularity))
      fail(422, 'VALIDATION_ERROR', 'granularity');
    const clippedTo = Math.min(to, floorMinute(Date.now()));
    return HttpResponse.json(series(machine, plant, from, clippedTo, granularity as Granularity));
  }),

  handle('get', '/plants/:id/oee/summary', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const date = new URL(request.url).searchParams.get('date');
    const now = Date.now();
    let window: [number, number];
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(422, 'VALIDATION_ERROR', 'date');
      window = dayWindow(plant, parseDayKey(date, plant.timezone).getTime(), now);
    } else {
      window = todayWindow(plant, now);
    }
    return HttpResponse.json(summary(plant, machinesOf(plant.id), window[0], window[1]));
  }),

  handle('get', '/machines/:id/events', ({ request, params }) => {
    const user = currentUser(request);
    const { machine } = requireMachine(user, idParam(params, 'id'));
    advance(Date.now());
    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const from = fromParam ? parseInstant(fromParam, 'from') : null;
    const to = toParam ? parseInstant(toParam, 'to') : null;
    const state = url.searchParams.get('state');
    if (state && !isMachineState(state)) fail(422, 'VALIDATION_ERROR', 'state');
    const events = (db.events.get(machine.id) ?? [])
      .filter(
        (event) =>
          (to === null || event.started_at < to) &&
          (from === null || event.ended_at === null || event.ended_at > from),
      )
      .filter((event) => !state || event.state === state)
      .sort((a, b) => b.started_at - a.started_at || b.id - a.id)
      .map(toEvent);
    return HttpResponse.json(paginate(events, url));
  }),

  handle('patch', '/events/:id', async ({ request, params }) => {
    const user = currentUser(request);
    const event = findEvent(idParam(params, 'id'));
    if (!event) fail(404, 'NOT_FOUND');
    requireMachine(user, event.machine_id, ['owner', 'supervisor']);
    const body = await readBody(request);
    if (body.reason_code !== undefined) {
      const code = body.reason_code;
      if (code !== null && (typeof code !== 'string' || !db.reasons.some((r) => r.code === code))) {
        fail(422, 'VALIDATION_ERROR', 'reason_code');
      }
      event.reason_code = code;
    }
    if (body.comment !== undefined) {
      const comment = body.comment;
      if (comment !== null && (typeof comment !== 'string' || comment.length > 500)) {
        fail(422, 'VALIDATION_ERROR', 'comment');
      }
      event.comment = comment === null ? null : comment.trim() || null;
    }
    event.classified_by = user.id;
    return HttpResponse.json(toEvent(event));
  }),

  handle('get', '/downtime-reasons', ({ request }) => {
    currentUser(request);
    const reasons = [...db.reasons].sort((a, b) => Number(a.code) - Number(b.code));
    return HttpResponse.json(paginate(reasons, new URL(request.url)));
  }),

  handle('get', '/plants/:id/reports/oee.csv', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const [from, to] = parseWindow(new URL(request.url));
    const clippedTo = Math.min(to, floorMinute(Date.now()));
    advance(Date.now());
    const csv = csvFor(plant, machinesOf(plant.id), from, clippedTo);
    const filename = `oee_${plant.slug}_${compactStamp(from)}_${compactStamp(to)}.csv`;
    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }),

  handle('get', '/plants/:id/alert-rules', ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'));
    const rules = db.alertRules
      .filter((rule) => rule.plant_id === plant.id)
      .sort((a, b) => a.id - b.id);
    return HttpResponse.json(paginate(rules, new URL(request.url)));
  }),

  handle('post', '/plants/:id/alert-rules', async ({ request, params }) => {
    const user = currentUser(request);
    const { plant } = requireMembership(user, idParam(params, 'id'), ['owner', 'supervisor']);
    const input = validateRule(await readBody(request), plant, false);
    if (input.type === 'OEE_BELOW' && input.threshold === null)
      fail(422, 'VALIDATION_ERROR', 'threshold');
    const rule: AlertRule = {
      id: db.ids.rule++,
      plant_id: plant.id,
      machine_id: input.machine_id ?? null,
      type: input.type ?? 'MACHINE_DOWN',
      threshold: input.type === 'OEE_BELOW' ? (input.threshold ?? null) : null,
      duration_s: input.duration_s ?? 300,
      is_active: input.is_active ?? true,
    };
    db.alertRules.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),

  handle('patch', '/alert-rules/:id', async ({ request, params }) => {
    const user = currentUser(request);
    const rule = db.alertRules.find((item) => item.id === idParam(params, 'id'));
    if (!rule) fail(404, 'NOT_FOUND');
    const { plant } = requireMembership(user, rule.plant_id, ['owner', 'supervisor']);
    const input = validateRule(await readBody(request), plant, true);
    const next = { ...rule, ...input };
    if (next.type === 'OEE_BELOW' && next.threshold === null)
      fail(422, 'VALIDATION_ERROR', 'threshold');
    if (next.type !== 'OEE_BELOW') next.threshold = null;
    Object.assign(rule, next);
    return HttpResponse.json(rule);
  }),

  handle('delete', '/alert-rules/:id', ({ request, params }) => {
    const user = currentUser(request);
    const rule = db.alertRules.find((item) => item.id === idParam(params, 'id'));
    if (!rule) fail(404, 'NOT_FOUND');
    requireMembership(user, rule.plant_id, ['owner', 'supervisor']);
    db.alertRules = db.alertRules.filter((item) => item !== rule);
    return noContent();
  }),

  handle('get', '/notifications', ({ request }) => {
    const user = currentUser(request);
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const items = db.notifications
      .filter((item) => item.user_id === user.id && (!unreadOnly || item.read_at === null))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .map((item) => ({
        id: item.id,
        type: item.type,
        created_at: item.created_at,
        read_at: item.read_at,
        payload: item.payload,
      }));
    return HttpResponse.json(paginate(items, url));
  }),

  handle('post', '/notifications/read-all', ({ request }) => {
    const user = currentUser(request);
    const now = new Date().toISOString();
    for (const item of db.notifications) {
      if (item.user_id === user.id && item.read_at === null) item.read_at = now;
    }
    return noContent();
  }),

  handle('post', '/notifications/:id/read', ({ request, params }) => {
    const user = currentUser(request);
    const id = idParam(params, 'id');
    const item = db.notifications.find((n) => n.id === id && n.user_id === user.id);
    if (!item) fail(404, 'NOT_FOUND');
    item.read_at ??= new Date().toISOString();
    return noContent();
  }),

  handle('get', '/watchlist/unfollow', ({ request }) => {
    const url = new URL(request.url);
    const match = /^unfollow\.(\d+)\.(\d+)$/.exec(url.searchParams.get('token') ?? '');
    const user = match?.[1] ? findUser(Number(match[1])) : undefined;
    const machineId = match?.[2] ? Number(match[2]) : Number.NaN;
    if (!user || !Number.isInteger(machineId)) fail(400, 'INVALID_TOKEN');
    db.watchlist = db.watchlist.filter(
      (item) => !(item.user_id === user.id && item.machine_id === machineId),
    );
    return HttpResponse.redirect(
      `${env.siteUrl}/${user.language}/app/watchlist?unfollowed=${machineId}`,
      303,
    );
  }),

  handle('get', '/watchlist', ({ request }) => {
    const user = currentUser(request);
    const now = Date.now();
    const items = db.watchlist
      .filter((item) => item.user_id === user.id)
      .flatMap((item) => {
        const machine = findMachine(item.machine_id);
        const plant = machine ? findPlant(machine.plant_id) : undefined;
        if (!machine || !plant || !memberRole(user.id, plant.id)) return [];
        return [
          {
            ...toMachine(machine, plant, user, now),
            plant: { id: plant.id, slug: plant.slug, name: plant.name, timezone: plant.timezone },
          },
        ];
      })
      .sort((a, b) => a.plant.name.localeCompare(b.plant.name) || a.name.localeCompare(b.name));
    return HttpResponse.json(paginate(items, new URL(request.url)));
  }),

  handle('put', '/watchlist/:machineId', ({ request, params }) => {
    const user = currentUser(request);
    const { machine } = requireMachine(user, idParam(params, 'machineId'));
    if (!db.watchlist.some((item) => item.user_id === user.id && item.machine_id === machine.id)) {
      db.watchlist.push({ user_id: user.id, machine_id: machine.id });
    }
    return noContent();
  }),

  handle('delete', '/watchlist/:machineId', ({ request, params }) => {
    const user = currentUser(request);
    const { machine } = requireMachine(user, idParam(params, 'machineId'));
    db.watchlist = db.watchlist.filter(
      (item) => !(item.user_id === user.id && item.machine_id === machine.id),
    );
    return noContent();
  }),

  http.get(api('/media/machines/:file'), ({ params }) => {
    const file = String(params.file ?? '');
    const key = file.replace(/_(320|768|1280)\.webp$/, '');
    const blob = db.photos.get(key);
    if (blob) return new HttpResponse(blob, { headers: { 'Content-Type': blob.type } });
    const machine = db.machines.find((item) => item.photo_key === key);
    return new HttpResponse(placeholderSvg(machine?.name ?? key), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }),
];

export const handlers = [
  ...baseHandlers,
  ...createInjectionHandlers(mockTools),
  ...createBoardHandlers(mockTools),
];
