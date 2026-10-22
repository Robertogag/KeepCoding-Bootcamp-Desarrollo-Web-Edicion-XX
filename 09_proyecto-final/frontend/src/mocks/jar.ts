import { isServer } from '@/lib/runtime';

const KEY = 'oee_mock_refresh';
let memory: string | null = null;

function storage(): Storage | null {
  try {
    return !isServer && typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// Sustituye a la cookie httpOnly del backend: el mock necesita sobrevivir a una recarga de página.
export const refreshJar = {
  get(): string | null {
    return storage()?.getItem(KEY) ?? memory;
  },
  set(token: string) {
    memory = token;
    storage()?.setItem(KEY, token);
  },
  clear() {
    memory = null;
    storage()?.removeItem(KEY);
  },
};
