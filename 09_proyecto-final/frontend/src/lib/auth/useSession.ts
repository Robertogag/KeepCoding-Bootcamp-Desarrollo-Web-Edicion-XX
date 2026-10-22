import { useSyncExternalStore } from 'react';
import { getInitialSession, getSession, subscribeSession, type Session } from './session';

export function useSession(): Session {
  return useSyncExternalStore(subscribeSession, getSession, getInitialSession);
}
