import { HttpResponse } from 'msw';
import type {
  AssignmentRole,
  CatalogItem,
  Employee,
  LineDowntime,
  MachineVariable,
  Mold,
  OrderStatus,
  PlantRole,
  Product,
  ProductionLine,
  ProductionOrder,
  ProductionRun,
  Recipe,
  Resin,
  ResinLot,
  RunAssignment,
  RunMaterial,
  TelemetrySample,
  VariableDataType,
  WordOrder,
} from '@/lib/api/types';
import { db, findMachine, machinesOf, memberRole, type MockUser } from './data';
import type { MockTools } from './handlers';
import {
  contextFor,
  DEMO_MAP,
  idealSecondsPerPiece,
  injectionDb,
  lineOf,
  openRunOf,
  sampleAt,
  TELEMETRY_STEP,
} from './injection-data';

const WRITE: PlantRole[] = ['owner', 'supervisor'];
const ORDER_STATUSES: OrderStatus[] = ['planned', 'running', 'completed', 'cancelled'];
const ASSIGNMENT_ROLES: AssignmentRole[] = ['operator', 'technician', 'quality', 'supervisor'];
const DATA_TYPES: VariableDataType[] = ['uint16', 'int16', 'uint32', 'int32', 'float32'];
const ORDERS: WordOrder[] = ['big', 'little'];
const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const VARIABLE_CODE = /^[a-z][a-z0-9_]{0,39}$/;

type Body = Record<string, unknown>;

function now(): string {
  return new Date().toISOString();
}

function ms(value: string): number {
  return new Date(value).getTime();
}

export function createInjectionHandlers(tools: MockTools) {
  const {
    handle,
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
  } = tools;

  // Declarada como función para que TypeScript sepa que no regresa y estreche los tipos.
  function fail(status: number, code: string, field?: string): never {
    return tools.fail(status, code, field);
  }

  // Cada listado solo admite sus propios filtros; uno ajeno responde 422 con el nombre del parámetro.
  function filters(url: URL, allowed: string[]): URLSearchParams {
    for (const key of url.searchParams.keys()) {
      if (!['page', 'page_size', ...allowed].includes(key)) fail(422, 'VALIDATION_ERROR', key);
    }
    return url.searchParams;
  }

  function optionalInt(params: URLSearchParams, key: string): number | undefined {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) fail(422, 'VALIDATION_ERROR', key);
    return value;
  }

  function optionalBool(params: URLSearchParams, key: string): boolean | undefined {
    const raw = params.get(key);
    if (raw === null) return undefined;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    fail(422, 'VALIDATION_ERROR', key);
  }

  function optionalInstant(params: URLSearchParams, key: string): number | undefined {
    const raw = params.get(key);
    return raw === null ? undefined : parseInstant(raw, key);
  }

  function range(params: URLSearchParams): [number | undefined, number | undefined] {
    const from = optionalInstant(params, 'from');
    const to = optionalInstant(params, 'to');
    if (from !== undefined && to !== undefined && from >= to) fail(422, 'VALIDATION_ERROR', 'to');
    return [from, to];
  }

  function overlaps(start: string, end: string | null, from?: number, to?: number): boolean {
    const startMs = ms(start);
    const endMs = end === null ? Number.POSITIVE_INFINITY : ms(end);
    if (from !== undefined && endMs <= from) return false;
    if (to !== undefined && startMs >= to) return false;
    return true;
  }

  function within(stamp: string, from?: number, to?: number): boolean {
    const value = ms(stamp);
    if (from !== undefined && value < from) return false;
    if (to !== undefined && value >= to) return false;
    return true;
  }

  function code(body: Body, field = 'code'): string {
    const value = str(body, field, 1, 40);
    if (!CODE.test(value)) fail(422, 'VALIDATION_ERROR', field);
    return value;
  }

  function uniqueCode<T extends { id: number; plant_id: number; code: string }>(
    items: T[],
    plantId: number,
    value: string,
    exceptId?: number,
  ) {
    const clash = items.some(
      (item) =>
        item.plant_id === plantId &&
        item.id !== exceptId &&
        item.code.toLowerCase() === value.toLowerCase(),
    );
    if (clash) fail(409, 'RESOURCE_CONFLICT', 'code');
  }

  function base(body: Body): { code: string; name: string; is_active: boolean } {
    return {
      code: code(body),
      name: str(body, 'name', 1, 120),
      is_active: bool(body, 'is_active', true),
    };
  }

  function activeIn<T extends CatalogItem>(
    items: T[],
    plantId: number,
    id: number,
    field: string,
  ): T {
    const item = items.find((entry) => entry.id === id && entry.plant_id === plantId);
    if (!item || !item.is_active) fail(422, 'VALIDATION_ERROR', field);
    return item;
  }

  function findIn<T extends { id: number; plant_id: number }>(
    items: T[],
    plantId: number,
    id: number,
  ): T {
    const item = items.find((entry) => entry.id === id && entry.plant_id === plantId);
    if (!item) fail(404, 'NOT_FOUND');
    return item;
  }

  interface CatalogSpec<T extends CatalogItem> {
    path: string;
    items: () => T[];
    nextId: () => number;
    fields: (body: Body, plantId: number, existing?: T) => Omit<T, keyof CatalogItem>;
  }

  function catalogRoutes<T extends CatalogItem>(spec: CatalogSpec<T>) {
    return [
      handle('get', `/plants/:plantId/${spec.path}`, ({ request, params }) => {
        const user = currentUser(request);
        const { plant } = requireMembership(user, idParam(params, 'plantId'));
        filters(new URL(request.url), []);
        const items = spec
          .items()
          .filter((item) => item.plant_id === plant.id)
          .sort((a, b) => a.code.localeCompare(b.code));
        return HttpResponse.json(paginate(items, new URL(request.url)));
      }),
      handle('post', `/plants/:plantId/${spec.path}`, async ({ request, params }) => {
        const user = currentUser(request);
        const { plant } = requireMembership(user, idParam(params, 'plantId'), WRITE);
        const body = await readBody(request);
        const common = base(body);
        uniqueCode(spec.items(), plant.id, common.code);
        const item = {
          id: spec.nextId(),
          plant_id: plant.id,
          ...common,
          created_at: now(),
          ...spec.fields(body, plant.id),
        } as T;
        spec.items().push(item);
        return HttpResponse.json(item, { status: 201 });
      }),
      handle('put', `/plants/:plantId/${spec.path}/:itemId`, async ({ request, params }) => {
        const user = currentUser(request);
        const { plant } = requireMembership(user, idParam(params, 'plantId'), WRITE);
        const existing = findIn(spec.items(), plant.id, idParam(params, 'itemId'));
        const body = await readBody(request);
        const common = base(body);
        uniqueCode(spec.items(), plant.id, common.code, existing.id);
        Object.assign(existing, common, spec.fields(body, plant.id, existing));
        return HttpResponse.json(existing);
      }),
    ];
  }

  function lineStopped(lineId: number): LineDowntime | undefined {
    return injectionDb.downtimes.find((item) => item.line_id === lineId && item.ended_at === null);
  }

  function machineInOpenDowntime(machineId: number): boolean {
    return injectionDb.downtimes.some(
      (item) => item.ended_at === null && item.affected_machine_ids.includes(machineId),
    );
  }

  function lotBalance(lot: ResinLot): number {
    const consumed = injectionDb.materials
      .filter((item) => item.resin_lot_id === lot.id)
      .reduce((sum, item) => sum + item.consumed_kg, 0);
    return lot.received_kg - consumed;
  }

  function requireRun(user: MockUser, runId: number, roles?: PlantRole[]): ProductionRun {
    const item = injectionDb.runs.find((entry) => entry.id === runId);
    if (!item) fail(404, 'NOT_FOUND');
    requireMembership(user, item.plant_id, roles);
    return item;
  }

  function requireOpenRun(user: MockUser, runId: number): ProductionRun {
    const item = requireRun(user, runId, WRITE);
    if (item.ended_at !== null) fail(409, 'RESOURCE_CONFLICT');
    return item;
  }

  function endAssignments(runId: number) {
    const closedAt = now();
    for (const assignment of injectionDb.assignments) {
      if (assignment.run_id === runId && assignment.ended_at === null)
        assignment.ended_at = closedAt;
    }
  }

  function telemetryWindow(url: URL): [number, number] {
    const from = parseInstant(url.searchParams.get('from'), 'from');
    const to = parseInstant(url.searchParams.get('to'), 'to');
    if (from >= to) fail(422, 'VALIDATION_ERROR', 'to');
    return [from, to];
  }

  return [
    ...catalogRoutes<ProductionLine>({
      path: 'production-lines',
      items: () => injectionDb.lines,
      nextId: () => injectionDb.ids.line++,
      fields: () => ({}),
    }),
    ...catalogRoutes<Product>({
      path: 'products',
      items: () => injectionDb.products,
      nextId: () => injectionDb.ids.product++,
      fields: (body) => ({
        part_weight_g: num(body, 'part_weight_g', 0.001, 100_000),
        description: optionalStr(body, 'description', 0, 500) ?? '',
      }),
    }),
    ...catalogRoutes<Mold>({
      path: 'molds',
      items: () => injectionDb.molds,
      nextId: () => injectionDb.ids.mold++,
      fields: (body) => ({ nominal_cavities: int(body, 'nominal_cavities', 1, 1024) }),
    }),
    ...catalogRoutes<Resin>({
      path: 'resins',
      items: () => injectionDb.resins,
      nextId: () => injectionDb.ids.resin++,
      fields: (body) => ({
        polymer: str(body, 'polymer', 1, 40),
        grade: str(body, 'grade', 1, 40),
        manufacturer: optionalStr(body, 'manufacturer', 0, 80) ?? '',
      }),
    }),
    ...catalogRoutes<Employee>({
      path: 'employees',
      items: () => injectionDb.employees,
      nextId: () => injectionDb.ids.employee++,
      fields: (body, plantId) => {
        const raw = body.user_id;
        if (raw === undefined || raw === null) return { user_id: null };
        const userId = int(body, 'user_id', 1, Number.MAX_SAFE_INTEGER);
        if (!memberRole(userId, plantId)) fail(422, 'VALIDATION_ERROR', 'user_id');
        return { user_id: userId };
      },
    }),
    ...catalogRoutes<Recipe>({
      path: 'injection-recipes',
      items: () => injectionDb.recipes,
      nextId: () => injectionDb.ids.recipe++,
      fields: (body, plantId) => {
        const product = activeIn(
          injectionDb.products,
          plantId,
          int(body, 'product_id', 1, 1e9),
          'product_id',
        );
        const mold = activeIn(injectionDb.molds, plantId, int(body, 'mold_id', 1, 1e9), 'mold_id');
        const resin = activeIn(
          injectionDb.resins,
          plantId,
          int(body, 'resin_id', 1, 1e9),
          'resin_id',
        );
        const cavities = int(body, 'active_cavities', 1, 1024);
        if (cavities > mold.nominal_cavities) fail(422, 'VALIDATION_ERROR', 'active_cavities');
        return {
          product_id: product.id,
          mold_id: mold.id,
          resin_id: resin.id,
          ideal_cycle_s: num(body, 'ideal_cycle_s', 0.1, 3600),
          active_cavities: cavities,
        };
      },
    }),

    handle('put', '/machines/:machineId/line', async ({ request, params }) => {
      const user = currentUser(request);
      const { machine, plant } = requireMachine(user, idParam(params, 'machineId'), WRITE);
      const body = await readBody(request);
      const raw = body.line_id;
      let lineId: number | null = null;
      if (raw !== null && raw !== undefined) {
        lineId = activeIn(injectionDb.lines, plant.id, int(body, 'line_id', 1, 1e9), 'line_id').id;
      }
      if (machineInOpenDowntime(machine.id)) fail(409, 'RESOURCE_CONFLICT');
      if (lineId !== null && lineStopped(lineId)) fail(409, 'RESOURCE_CONFLICT', 'line_id');
      if (lineId === null) injectionDb.machineLines.delete(machine.id);
      else injectionDb.machineLines.set(machine.id, lineId);
      return HttpResponse.json({ machine_id: machine.id, line_id: lineId });
    }),

    handle('post', '/plants/:plantId/resin-lots', async ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'), WRITE);
      const body = await readBody(request);
      const resin = activeIn(
        injectionDb.resins,
        plant.id,
        int(body, 'resin_id', 1, 1e9),
        'resin_id',
      );
      const lotCode = code(body, 'lot_code');
      if (
        injectionDb.lots.some(
          (item) =>
            item.plant_id === plant.id && item.lot_code.toLowerCase() === lotCode.toLowerCase(),
        )
      ) {
        fail(409, 'RESOURCE_CONFLICT', 'lot_code');
      }
      const lot: ResinLot = {
        id: injectionDb.ids.lot++,
        plant_id: plant.id,
        resin_id: resin.id,
        lot_code: lotCode,
        received_kg: num(body, 'received_kg', 0.001, 1_000_000),
        received_at: now(),
      };
      injectionDb.lots.push(lot);
      return HttpResponse.json(lot, { status: 201 });
    }),

    handle('get', '/plants/:plantId/injection/resin-lots', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      const url = new URL(request.url);
      const query = filters(url, ['resin_id', 'from', 'to']);
      const resinId = optionalInt(query, 'resin_id');
      const [from, to] = range(query);
      const items = injectionDb.lots
        .filter((item) => item.plant_id === plant.id)
        .filter((item) => resinId === undefined || item.resin_id === resinId)
        .filter((item) => within(item.received_at, from, to))
        .sort((a, b) => ms(b.received_at) - ms(a.received_at));
      return HttpResponse.json(paginate(items, url));
    }),

    handle('post', '/plants/:plantId/production-orders', async ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'), WRITE);
      const body = await readBody(request);
      const orderCode = code(body);
      uniqueCode(injectionDb.orders, plant.id, orderCode);
      const recipe = activeIn(
        injectionDb.recipes,
        plant.id,
        int(body, 'recipe_id', 1, 1e9),
        'recipe_id',
      );
      const order: ProductionOrder = {
        id: injectionDb.ids.order++,
        plant_id: plant.id,
        code: orderCode,
        recipe_id: recipe.id,
        target_pieces: int(body, 'target_pieces', 1, 100_000_000),
        status: 'planned',
        created_at: now(),
      };
      injectionDb.orders.push(order);
      return HttpResponse.json(order, { status: 201 });
    }),

    handle('get', '/plants/:plantId/injection/production-orders', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      const url = new URL(request.url);
      const query = filters(url, ['status', 'from', 'to']);
      const status = query.get('status');
      if (status !== null && !ORDER_STATUSES.includes(status as OrderStatus)) {
        fail(422, 'VALIDATION_ERROR', 'status');
      }
      const [from, to] = range(query);
      const items = injectionDb.orders
        .filter((item) => item.plant_id === plant.id)
        .filter((item) => status === null || item.status === status)
        .filter((item) => within(item.created_at, from, to))
        .sort((a, b) => ms(b.created_at) - ms(a.created_at));
      return HttpResponse.json(paginate(items, url));
    }),

    handle('patch', '/production-orders/:orderId', async ({ request, params }) => {
      const user = currentUser(request);
      const order = injectionDb.orders.find((item) => item.id === idParam(params, 'orderId'));
      if (!order) fail(404, 'NOT_FOUND');
      requireMembership(user, order.plant_id, WRITE);
      const body = await readBody(request);
      const status = body.status;
      if (status !== 'planned' && status !== 'completed' && status !== 'cancelled') {
        fail(422, 'VALIDATION_ERROR', 'status');
      }
      if (injectionDb.runs.some((item) => item.order_id === order.id && item.ended_at === null)) {
        fail(409, 'RESOURCE_CONFLICT', 'status');
      }
      order.status = status;
      return HttpResponse.json(order);
    }),

    handle('get', '/plants/:plantId/injection/production-runs', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      const url = new URL(request.url);
      const query = filters(url, ['machine_id', 'line_id', 'order_id', 'open', 'from', 'to']);
      const machineId = optionalInt(query, 'machine_id');
      const lineId = optionalInt(query, 'line_id');
      const orderId = optionalInt(query, 'order_id');
      const open = optionalBool(query, 'open');
      const [from, to] = range(query);
      const items = injectionDb.runs
        .filter((item) => item.plant_id === plant.id)
        .filter((item) => machineId === undefined || item.machine_id === machineId)
        .filter((item) => lineId === undefined || item.context.line_id === lineId)
        .filter((item) => orderId === undefined || item.order_id === orderId)
        .filter((item) => open === undefined || (item.ended_at === null) === open)
        .filter((item) => overlaps(item.started_at, item.ended_at, from, to))
        .sort((a, b) => ms(b.started_at) - ms(a.started_at));
      return HttpResponse.json(paginate(items, url));
    }),

    handle('post', '/machines/:machineId/production-runs', async ({ request, params }) => {
      const user = currentUser(request);
      const { machine, plant } = requireMachine(user, idParam(params, 'machineId'), WRITE);
      const body = await readBody(request);
      const order = findIn(injectionDb.orders, plant.id, int(body, 'order_id', 1, 1e9));
      if (order.status !== 'planned') fail(409, 'RESOURCE_CONFLICT', 'order_id');
      const recipe = activeIn(injectionDb.recipes, plant.id, order.recipe_id, 'order_id');
      const mold = findIn(injectionDb.molds, plant.id, recipe.mold_id);
      const product = findIn(injectionDb.products, plant.id, recipe.product_id);
      if (openRunOf(machine.id)) fail(409, 'RESOURCE_CONFLICT');
      if (injectionDb.runs.some((item) => item.mold_id === mold.id && item.ended_at === null)) {
        fail(409, 'RESOURCE_CONFLICT', 'order_id');
      }
      const raw = body.active_cavities;
      const cavities =
        raw === undefined || raw === null
          ? recipe.active_cavities
          : int(body, 'active_cavities', 1, 1024);
      if (cavities > mold.nominal_cavities) fail(422, 'VALIDATION_ERROR', 'active_cavities');
      const run: ProductionRun = {
        id: injectionDb.ids.run++,
        plant_id: plant.id,
        order_id: order.id,
        machine_id: machine.id,
        mold_id: mold.id,
        context: contextFor(recipe, lineOf(machine.id)),
        nominal_cavities: mold.nominal_cavities,
        active_cavities: cavities,
        ideal_cycle_s: recipe.ideal_cycle_s,
        part_weight_g: product.part_weight_g,
        started_by: user.id,
        ended_by: null,
        started_at: now(),
        ended_at: null,
      };
      injectionDb.runs.push(run);
      order.status = 'running';
      return HttpResponse.json(run, { status: 201 });
    }),

    handle('post', '/production-runs/:runId/end', ({ request, params }) => {
      const user = currentUser(request);
      const run = requireRun(user, idParam(params, 'runId'), WRITE);
      if (run.ended_at === null) {
        run.ended_at = now();
        run.ended_by = user.id;
        endAssignments(run.id);
        const order = injectionDb.orders.find((item) => item.id === run.order_id);
        if (order && order.status === 'running') order.status = 'planned';
      }
      return HttpResponse.json(run);
    }),

    handle('post', '/production-runs/:runId/materials', async ({ request, params }) => {
      const user = currentUser(request);
      const run = requireOpenRun(user, idParam(params, 'runId'));
      const body = await readBody(request);
      const lot = findIn(injectionDb.lots, run.plant_id, int(body, 'resin_lot_id', 1, 1e9));
      if (lot.resin_id !== run.context.resin_id) fail(422, 'VALIDATION_ERROR', 'resin_lot_id');
      const consumed = num(body, 'consumed_kg', 0.001, 1_000_000);
      if (consumed > lotBalance(lot) + 1e-9) fail(422, 'VALIDATION_ERROR', 'consumed_kg');
      const material: RunMaterial = {
        id: injectionDb.ids.material++,
        plant_id: run.plant_id,
        run_id: run.id,
        resin_lot_id: lot.id,
        consumed_kg: consumed,
        recorded_at: now(),
        recorded_by: user.id,
      };
      injectionDb.materials.push(material);
      return HttpResponse.json(material, { status: 201 });
    }),

    handle('post', '/production-runs/:runId/employees', async ({ request, params }) => {
      const user = currentUser(request);
      const run = requireOpenRun(user, idParam(params, 'runId'));
      const body = await readBody(request);
      const employee = activeIn(
        injectionDb.employees,
        run.plant_id,
        int(body, 'employee_id', 1, 1e9),
        'employee_id',
      );
      const role = body.role === undefined ? 'operator' : body.role;
      if (!ASSIGNMENT_ROLES.includes(role as AssignmentRole)) fail(422, 'VALIDATION_ERROR', 'role');
      const duplicate = injectionDb.assignments.some(
        (item) =>
          item.run_id === run.id && item.employee_id === employee.id && item.ended_at === null,
      );
      if (duplicate) fail(409, 'RESOURCE_CONFLICT', 'employee_id');
      const assignment: RunAssignment = {
        id: injectionDb.ids.assignment++,
        plant_id: run.plant_id,
        run_id: run.id,
        employee_id: employee.id,
        role: role as AssignmentRole,
        started_at: now(),
        ended_at: null,
      };
      injectionDb.assignments.push(assignment);
      return HttpResponse.json(assignment, { status: 201 });
    }),

    handle('post', '/production-runs/:runId/employees/:assignmentId/end', ({ request, params }) => {
      const user = currentUser(request);
      const run = requireRun(user, idParam(params, 'runId'), WRITE);
      const assignment = injectionDb.assignments.find(
        (item) => item.run_id === run.id && item.id === idParam(params, 'assignmentId'),
      );
      if (!assignment) fail(404, 'NOT_FOUND');
      if (assignment.ended_at === null) assignment.ended_at = now();
      return HttpResponse.json(assignment);
    }),

    handle('get', '/production-runs/:runId/traceability', ({ request, params }) => {
      const user = currentUser(request);
      const run = requireRun(user, idParam(params, 'runId'));
      return HttpResponse.json({
        run,
        materials: injectionDb.materials.filter((item) => item.run_id === run.id),
        employees: injectionDb.assignments.filter((item) => item.run_id === run.id),
        ideal_seconds_per_piece: idealSecondsPerPiece(run),
      });
    }),

    handle('get', '/machines/:machineId/production-context', ({ request, params }) => {
      const user = currentUser(request);
      const { machine } = requireMachine(user, idParam(params, 'machineId'));
      const run = openRunOf(machine.id) ?? null;
      return HttpResponse.json({
        run,
        ideal_seconds_per_piece: run ? idealSecondsPerPiece(run) : null,
      });
    }),

    handle('post', '/production-lines/:lineId/downtimes', async ({ request, params }) => {
      const user = currentUser(request);
      const line = injectionDb.lines.find((item) => item.id === idParam(params, 'lineId'));
      if (!line) fail(404, 'NOT_FOUND');
      requireMembership(user, line.plant_id, WRITE);
      const body = await readBody(request);
      const reason = str(body, 'reason_code', 1, 10);
      if (!db.reasons.some((item) => item.code === reason))
        fail(422, 'VALIDATION_ERROR', 'reason_code');
      const affected = machinesOf(line.plant_id)
        .filter((machine) => machine.is_active && lineOf(machine.id) === line.id)
        .map((machine) => machine.id);
      if (affected.length === 0) fail(409, 'RESOURCE_CONFLICT');
      if (lineStopped(line.id)) fail(409, 'RESOURCE_CONFLICT');
      const downtime: LineDowntime = {
        id: injectionDb.ids.downtime++,
        plant_id: line.plant_id,
        line_id: line.id,
        reason_code: reason,
        planned: bool(body, 'planned', false),
        comment: optionalStr(body, 'comment', 0, 500) ?? '',
        started_at: now(),
        ended_at: null,
        created_by: user.id,
        ended_by: null,
        affected_machine_ids: affected,
      };
      injectionDb.downtimes.push(downtime);
      return HttpResponse.json(downtime, { status: 201 });
    }),

    handle('post', '/line-downtimes/:downtimeId/end', ({ request, params }) => {
      const user = currentUser(request);
      const downtime = injectionDb.downtimes.find(
        (item) => item.id === idParam(params, 'downtimeId'),
      );
      if (!downtime) fail(404, 'NOT_FOUND');
      requireMembership(user, downtime.plant_id, WRITE);
      if (downtime.ended_at === null) {
        downtime.ended_at = now();
        downtime.ended_by = user.id;
      }
      return HttpResponse.json(downtime);
    }),

    handle('get', '/plants/:plantId/injection/line-downtimes', ({ request, params }) => {
      const user = currentUser(request);
      const { plant } = requireMembership(user, idParam(params, 'plantId'));
      const url = new URL(request.url);
      const query = filters(url, ['line_id', 'machine_id', 'open', 'from', 'to']);
      const lineId = optionalInt(query, 'line_id');
      const machineId = optionalInt(query, 'machine_id');
      const open = optionalBool(query, 'open');
      const [from, to] = range(query);
      const items = injectionDb.downtimes
        .filter((item) => item.plant_id === plant.id)
        .filter((item) => lineId === undefined || item.line_id === lineId)
        .filter((item) => machineId === undefined || item.affected_machine_ids.includes(machineId))
        .filter((item) => open === undefined || (item.ended_at === null) === open)
        .filter((item) => overlaps(item.started_at, item.ended_at, from, to))
        .sort((a, b) => ms(b.started_at) - ms(a.started_at));
      return HttpResponse.json(paginate(items, url));
    }),

    handle('get', '/machines/:machineId/variables', ({ request, params }) => {
      const user = currentUser(request);
      const { machine } = requireMachine(user, idParam(params, 'machineId'));
      const url = new URL(request.url);
      filters(url, []);
      const items = injectionDb.variables
        .filter((item) => item.machine_id === machine.id)
        .sort((a, b) => a.address - b.address);
      return HttpResponse.json(paginate(items, url));
    }),

    handle('put', '/machines/:machineId/variables/:code', async ({ request, params }) => {
      const user = currentUser(request);
      const { machine } = requireMachine(user, idParam(params, 'machineId'), WRITE);
      const variableCode = decodeURIComponent(params.code ?? '');
      if (!VARIABLE_CODE.test(variableCode)) fail(422, 'VALIDATION_ERROR', 'code');
      const body = await readBody(request);
      const address = int(body, 'address', 9, 65_535);
      const dataType = body.data_type;
      if (!DATA_TYPES.includes(dataType as VariableDataType))
        fail(422, 'VALIDATION_ERROR', 'data_type');
      const wordOrder = body.word_order ?? 'big';
      const byteOrder = body.byte_order ?? 'big';
      if (!ORDERS.includes(wordOrder as WordOrder)) fail(422, 'VALIDATION_ERROR', 'word_order');
      if (!ORDERS.includes(byteOrder as WordOrder)) fail(422, 'VALIDATION_ERROR', 'byte_order');
      const existing = injectionDb.variables.find(
        (item) => item.machine_id === machine.id && item.code === variableCode,
      );
      const isActive = bool(body, 'is_active', true);
      const clash = injectionDb.variables.some(
        (item) =>
          item.machine_id === machine.id &&
          item.code !== variableCode &&
          item.is_active &&
          isActive &&
          item.address === address,
      );
      if (clash) fail(409, 'RESOURCE_CONFLICT', 'address');
      const fields: Omit<MachineVariable, 'id' | 'machine_id'> = {
        code: variableCode,
        name: str(body, 'name', 1, 80),
        unit: optionalStr(body, 'unit', 0, 16) ?? '',
        address,
        data_type: dataType as VariableDataType,
        word_order: wordOrder as WordOrder,
        byte_order: byteOrder as WordOrder,
        scale: body.scale === undefined ? 1 : num(body, 'scale', -1e9, 1e9),
        offset: body.offset === undefined ? 0 : num(body, 'offset', -1e9, 1e9),
        is_active: isActive,
        map_version: optionalStr(body, 'map_version', 1, 40) ?? existing?.map_version ?? DEMO_MAP,
      };
      if (existing) {
        Object.assign(existing, fields);
        return HttpResponse.json(existing);
      }
      const created: MachineVariable = {
        id: injectionDb.ids.variable++,
        machine_id: machine.id,
        ...fields,
      };
      injectionDb.variables.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),

    handle('get', '/machines/:machineId/telemetry', ({ request, params }) => {
      const user = currentUser(request);
      const { machine } = requireMachine(user, idParam(params, 'machineId'));
      const url = new URL(request.url);
      filters(url, ['from', 'to']);
      const [from, to] = telemetryWindow(url);
      const end = Math.min(to, Date.now());
      const samples: TelemetrySample[] = [];
      const first = Math.ceil(from / TELEMETRY_STEP) * TELEMETRY_STEP;
      for (let at = first; at < end && samples.length < 50_000; at += TELEMETRY_STEP) {
        samples.push(sampleAt(machine.id, at));
      }
      return HttpResponse.json(paginate(samples, url));
    }),
  ];
}

export function machineLineId(machineId: number): number | null {
  return findMachine(machineId) ? lineOf(machineId) : null;
}

export function idealSecondsFor(machineId: number, at: number): number | null {
  const current = injectionDb.runs.find(
    (item) =>
      item.machine_id === machineId &&
      ms(item.started_at) <= at &&
      (item.ended_at === null || ms(item.ended_at) > at),
  );
  return current ? idealSecondsPerPiece(current) : null;
}
