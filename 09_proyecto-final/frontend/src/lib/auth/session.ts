import type { User } from '@/lib/api/types';
import { isServer } from '@/lib/runtime';
import { SESSION_COOKIE, SESSION_COOKIE_MAX_AGE } from './cookie';

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';
// 'signout' distingue el cierre voluntario del vencimiento: la pantalla decide si manda a login o al inicio.
export type SessionEndReason = 'none' | 'expired' | 'signout';

export interface Session {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  reason: SessionEndReason;
}

const initialSession: Session = {
  status: 'unknown',
  user: null,
  accessToken: null,
  reason: 'none',
};
let session: Session = initialSession;
const listeners = new Set<() => void>();

function emit(next: Session) {
  session = next;
  listeners.forEach((listener) => listener());
}

export function getSession(): Session {
  return session;
}

export function getInitialSession(): Session {
  return initialSession;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return session.accessToken;
}

export function setSession(user: User, accessToken: string) {
  emit({ status: 'authenticated', user, accessToken, reason: 'none' });
  writeMarker(true);
}

export function setAccessToken(accessToken: string) {
  emit({ ...session, accessToken, status: session.user ? 'authenticated' : session.status });
  writeMarker(true);
}

export function setSessionUser(user: User) {
  emit({ ...session, user, status: 'authenticated' });
}

export function clearSession(reason: SessionEndReason = 'expired') {
  emit({ status: 'anonymous', user: null, accessToken: null, reason });
  writeMarker(false);
}

// Sin respuesta del servidor no se puede saber si la sesión sigue viva: se deja la marca para el próximo intento.
export function markSessionAnonymous() {
  emit({ status: 'anonymous', user: null, accessToken: null, reason: 'none' });
}

export function hasSessionMarker(): boolean {
  if (isServer || typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((item) => item.startsWith(`${SESSION_COOKIE}=`));
}

// La cookie de marca solo le dice al proxy que hay sesión; la credencial real es el refresh httpOnly.
function writeMarker(active: boolean) {
  if (isServer || typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = active
    ? `${SESSION_COOKIE}=1; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
    : `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
