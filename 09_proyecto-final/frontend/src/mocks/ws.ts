import type { AppNotification, ServerMessage } from '@/lib/api/types';
import type { SocketLike } from '@/lib/realtime/client';
import {
  db,
  findPlant,
  findUser,
  machinesOf,
  memberRole,
  type MockNotification,
  type MockUser,
} from './data';
import { snapshotFor } from './oee';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;
const SNAPSHOT_EVERY_MS = 2_000;
const PING_EVERY_MS = 25_000;

function parseAccess(token: string | null): MockUser | null {
  const match = token ? /^mock\.(\d+)\.(\d+)$/.exec(token) : null;
  if (!match?.[1] || !match[2] || Number(match[2]) < Date.now()) return null;
  return findUser(Number(match[1])) ?? null;
}

// Imita el WebSocket del backend sobre los mismos datos de los handlers: snapshots cada 2 s y alguna notificación.
export class MockSocket implements SocketLike {
  readyState = CONNECTING;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;

  private readonly plants = new Set<number>();
  private readonly timers: Array<ReturnType<typeof setTimeout>> = [];
  private user: MockUser | null = null;
  private publicPlantId: number | null = null;

  constructor(url: string) {
    const parsed = new URL(url, 'http://localhost');
    const publicMatch = /\/ws\/public\/([^/?]+)/.exec(parsed.pathname);
    setTimeout(() => {
      if (publicMatch?.[1]) {
        const plant = db.plants.find((item) => item.slug === publicMatch[1] && item.is_public);
        if (!plant) {
          this.finish(4404);
          return;
        }
        this.publicPlantId = plant.id;
      } else {
        this.user = parseAccess(parsed.searchParams.get('token'));
        if (!this.user) {
          this.finish(4401);
          return;
        }
      }
      this.readyState = OPEN;
      this.onopen?.({});
      this.timers.push(setInterval(() => this.emitSnapshots(), SNAPSHOT_EVERY_MS));
      this.timers.push(setInterval(() => this.emit({ type: 'ping' }), PING_EVERY_MS));
      if (this.user) this.scheduleNotification();
    }, 150);
  }

  send(data: string) {
    if (this.readyState !== OPEN || !this.user) return;
    let message: { type?: string; plant_id?: number };
    try {
      message = JSON.parse(data) as { type?: string; plant_id?: number };
    } catch {
      return;
    }
    if (typeof message.plant_id !== 'number') return;
    if (message.type === 'subscribe') {
      if (!memberRole(this.user.id, message.plant_id)) {
        this.finish(4403);
        return;
      }
      this.plants.add(message.plant_id);
    }
    if (message.type === 'unsubscribe') this.plants.delete(message.plant_id);
  }

  close(code = 1000) {
    this.finish(code);
  }

  private finish(code: number) {
    if (this.readyState === CLOSED) return;
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
    this.readyState = CLOSED;
    this.onclose?.({ code, reason: '' });
  }

  private emit(message: ServerMessage) {
    if (this.readyState !== OPEN) return;
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  private emitSnapshots() {
    const now = Date.now();
    const plantIds = this.publicPlantId !== null ? [this.publicPlantId] : [...this.plants];
    for (const plantId of plantIds) {
      const plant = findPlant(plantId);
      if (!plant) continue;
      for (const machine of machinesOf(plantId)) {
        this.emit({
          type: 'machine.snapshot',
          plant_id: plantId,
          machine_id: machine.id,
          snapshot: snapshotFor(machine, plant, now),
          ts: new Date(now).toISOString(),
        });
      }
    }
  }

  private scheduleNotification() {
    const delay = 40_000 + Math.random() * 30_000;
    this.timers.push(setTimeout(() => this.emitNotification(), delay));
  }

  private emitNotification() {
    if (this.readyState !== OPEN || !this.user) return;
    const watched = db.watchlist
      .filter((item) => item.user_id === this.user?.id)
      .map((item) => db.machines.find((machine) => machine.id === item.machine_id))
      .filter((machine): machine is NonNullable<typeof machine> => Boolean(machine));
    const candidates =
      watched.length > 0 ? watched : [...this.plants].flatMap((plantId) => machinesOf(plantId));
    const machine = candidates[Math.floor(Math.random() * candidates.length)];
    if (machine) {
      const types: AppNotification['type'][] = ['MACHINE_DOWN', 'MACHINE_OFFLINE', 'OEE_BELOW'];
      const type = types[Math.floor(Math.random() * types.length)] ?? 'MACHINE_DOWN';
      const notification: MockNotification = {
        id: db.ids.notification++,
        user_id: this.user.id,
        type,
        created_at: new Date().toISOString(),
        read_at: null,
        payload:
          type === 'OEE_BELOW'
            ? {
                plant_id: machine.plant_id,
                machine_id: machine.id,
                machine_name: machine.name,
                oee: 0.52,
                threshold: 0.6,
              }
            : {
                plant_id: machine.plant_id,
                machine_id: machine.id,
                machine_name: machine.name,
                reason_code:
                  type === 'MACHINE_DOWN' ? String(1 + Math.floor(Math.random() * 12)) : null,
                duration_s: 300,
              },
      };
      db.notifications.push(notification);
      const { user_id: _owner, ...wire } = notification;
      void _owner;
      this.emit({ type: 'notification', notification: wire });
    }
    this.scheduleNotification();
  }
}
