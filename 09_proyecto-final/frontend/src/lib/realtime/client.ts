import type { ServerMessage } from '@/lib/api/types';
import { env } from '@/lib/env';

export type RealtimeStatus = 'live' | 'reconnecting' | 'offline';

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

const OPEN = 1;
export const CLOSE_UNAUTHORIZED = 4401;
export const CLOSE_FORBIDDEN = 4403;
export const CLOSE_NOT_FOUND = 4404;

async function openSocket(url: string): Promise<SocketLike> {
  if (env.mocking) {
    const { MockSocket } = await import('@/mocks/ws');
    return new MockSocket(url);
  }
  return new WebSocket(url) as unknown as SocketLike;
}

export interface RealtimeClientOptions {
  url: () => Promise<string | null>;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: RealtimeStatus) => void;
  // Devuelve true si consiguió credenciales nuevas y vale la pena reconectar.
  onAuthFailure?: () => Promise<boolean>;
  // Se llama al volver a abrir tras una caída: el estado REST puede haber cambiado mientras tanto.
  onReconnected?: () => void;
}

// Un socket por sesión: reconexión exponencial con jitter, suscripción por planta y manejo de los cierres 44xx.
export class RealtimeClient {
  private socket: SocketLike | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly plants = new Set<number>();
  private lastSubscribed: number | null = null;
  private everOpened = false;

  constructor(private readonly options: RealtimeClientOptions) {}

  start() {
    this.stopped = false;
    this.attempts = 0;
    void this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close(1000, 'client');
    }
    this.options.onStatus('offline');
  }

  subscribe(plantId: number) {
    this.plants.add(plantId);
    this.lastSubscribed = plantId;
    this.send({ type: 'subscribe', plant_id: plantId });
  }

  unsubscribe(plantId: number) {
    this.plants.delete(plantId);
    this.send({ type: 'unsubscribe', plant_id: plantId });
  }

  private send(payload: Record<string, unknown>) {
    if (this.socket && this.socket.readyState === OPEN) this.socket.send(JSON.stringify(payload));
  }

  private async connect() {
    if (this.stopped) return;
    this.options.onStatus('reconnecting');
    const url = await this.options.url();
    if (this.stopped) return;
    if (!url) {
      this.options.onStatus('offline');
      return;
    }
    const socket = await openSocket(url);
    if (this.stopped) {
      socket.close(1000, 'client');
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempts = 0;
      this.options.onStatus('live');
      for (const plantId of this.plants) this.send({ type: 'subscribe', plant_id: plantId });
      if (this.everOpened) this.options.onReconnected?.();
      this.everOpened = true;
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return;
      const message = parsed as ServerMessage;
      if (message.type === 'ping') return;
      this.options.onMessage(message);
    };

    socket.onerror = () => {
      // El cierre que sigue decide la reconexión; aquí no hay nada que hacer.
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      if (this.stopped) return;
      void this.handleClose(event.code);
    };
  }

  private async handleClose(code: number) {
    if (code === CLOSE_UNAUTHORIZED) {
      const renewed = this.options.onAuthFailure ? await this.options.onAuthFailure() : false;
      if (!renewed) {
        this.options.onStatus('offline');
        return;
      }
      this.attempts = 0;
      void this.connect();
      return;
    }
    if (code === CLOSE_FORBIDDEN && this.lastSubscribed !== null) {
      this.plants.delete(this.lastSubscribed);
      this.lastSubscribed = null;
      this.attempts = 0;
      void this.connect();
      return;
    }
    if (code === CLOSE_NOT_FOUND) {
      this.options.onStatus('offline');
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    this.options.onStatus('reconnecting');
    const base = Math.min(30_000, 1_000 * 2 ** this.attempts);
    const delay = base * (0.75 + Math.random() * 0.5);
    this.attempts += 1;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, delay);
  }
}
