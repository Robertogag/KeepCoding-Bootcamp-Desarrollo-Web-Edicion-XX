import { getMe, logoutRequest } from '@/lib/api/auth';
import { refreshAccessToken } from '@/lib/api/client';
import { resetQueryClient } from '@/lib/query/provider';
import { ensureMocks } from '@/mocks/ready';
import {
  clearSession,
  getSession,
  hasSessionMarker,
  markSessionAnonymous,
  setSessionUser,
} from './session';

let bootstrapping: Promise<void> | null = null;

// Al cargar la app se intenta un refresh silencioso; solo un 401 del refresh borra la marca de sesión.
export function bootstrapSession(): Promise<void> {
  if (getSession().status !== 'unknown') return Promise.resolve();
  if (!hasSessionMarker()) {
    markSessionAnonymous();
    return Promise.resolve();
  }
  bootstrapping ??= (async () => {
    await ensureMocks();
    const result = await refreshAccessToken();
    if (result === 'rejected') {
      clearSession();
      return;
    }
    if (result === 'unavailable') {
      markSessionAnonymous();
      return;
    }
    try {
      setSessionUser(await getMe());
    } catch {
      clearSession();
    }
  })().finally(() => {
    bootstrapping = null;
  });
  return bootstrapping;
}

export async function logout(): Promise<void> {
  try {
    await logoutRequest();
  } catch {
    // La sesión local se cierra aunque el servidor no responda.
  }
  clearSession('signout');
  resetQueryClient();
}
