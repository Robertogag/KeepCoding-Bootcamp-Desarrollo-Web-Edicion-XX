'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { refreshAccessToken } from '@/lib/api/client';
import type { ServerMessage } from '@/lib/api/types';
import { getAccessToken } from '@/lib/auth/session';
import { useSession } from '@/lib/auth/useSession';
import { env } from '@/lib/env';
import { describeNotification, machinePath } from '@/lib/notifications';
import { queryKeys } from '@/lib/query/keys';
import { applySnapshotToCaches } from '@/lib/realtime/cache';
import { RealtimeClient, type RealtimeStatus } from '@/lib/realtime/client';

interface RealtimeContextValue {
  status: RealtimeStatus;
  subscribe: (plantId: number) => void;
  unsubscribe: (plantId: number) => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [status, setStatus] = useState<RealtimeStatus>('offline');
  const clientRef = useRef<RealtimeClient | null>(null);
  const wanted = useRef(new Map<number, number>());
  const seen = useRef(new Set<number>());
  const authenticated = session.status === 'authenticated';

  const onMessage = useEffectEvent((message: ServerMessage) => {
    if (message.type === 'machine.snapshot') {
      applySnapshotToCaches(queryClient, message);
      return;
    }
    if (message.type !== 'notification') return;
    const notification = message.notification;
    if (seen.current.has(notification.id)) return;
    seen.current.add(notification.id);
    queryClient.setQueryData<number>(
      queryKeys.notifications.unreadCount,
      (count) => (count ?? 0) + 1,
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    toast({
      title: describeNotification(notification, t, locale),
      variant: notification.type === 'OEE_BELOW' ? 'info' : 'error',
      durationMs: 10_000,
      action: { label: t('viewMachine'), onClick: () => router.push(machinePath(notification)) },
    });
  });

  useEffect(() => {
    if (!authenticated) return;
    const client = new RealtimeClient({
      url: async () => {
        const token = getAccessToken();
        return token ? `${env.wsUrl}?token=${encodeURIComponent(token)}` : null;
      },
      onAuthFailure: async () => (await refreshAccessToken()) === 'ok',
      onStatus: setStatus,
      onMessage: (message) => onMessage(message),
      onReconnected: () => {
        void queryClient.invalidateQueries({ queryKey: ['plants'] });
        void queryClient.invalidateQueries({ queryKey: ['machines'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      },
    });
    clientRef.current = client;
    client.start();
    for (const plantId of wanted.current.keys()) client.subscribe(plantId);
    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [authenticated, queryClient]);

  // Varias pantallas pueden pedir la misma planta; se cuenta para dar de baja solo cuando ya nadie la mira.
  const subscribe = useCallback((plantId: number) => {
    const count = wanted.current.get(plantId) ?? 0;
    wanted.current.set(plantId, count + 1);
    if (count === 0) clientRef.current?.subscribe(plantId);
  }, []);

  const unsubscribe = useCallback((plantId: number) => {
    const count = (wanted.current.get(plantId) ?? 1) - 1;
    if (count <= 0) {
      wanted.current.delete(plantId);
      clientRef.current?.unsubscribe(plantId);
    } else {
      wanted.current.set(plantId, count);
    }
  }, []);

  const value = useMemo(
    () =>
      ({
        status: authenticated ? status : 'offline',
        subscribe,
        unsubscribe,
      }) as RealtimeContextValue,
    [authenticated, status, subscribe, unsubscribe],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error('RealtimeProvider is missing');
  return value;
}

export function usePlantSubscription(plantId: number | null) {
  const { subscribe, unsubscribe } = useRealtime();
  useEffect(() => {
    if (plantId === null) return;
    subscribe(plantId);
    return () => unsubscribe(plantId);
  }, [plantId, subscribe, unsubscribe]);
}
