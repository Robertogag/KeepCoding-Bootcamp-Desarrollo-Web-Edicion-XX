'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconBell } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { listNotifications, markNotificationRead } from '@/lib/api/notifications';
import type { AppNotification, Paginated } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { describeNotification, machinePath } from '@/lib/notifications';
import { queryKeys } from '@/lib/query/keys';
import { guessTimeZone } from '@/lib/timezones';

const iconButtonClasses =
  'inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-60';

// Campana con panel: las últimas notificaciones se leen aquí mismo, sin cambiar de pantalla.
export function NotificationsMenu({ unread, className }: { unread: number; className?: string }) {
  const t = useTranslations('notifications');
  const ta = useTranslations('alerts.types');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const timeZone = guessTimeZone();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const recent = useQuery({
    queryKey: queryKeys.notifications.list(false, 0),
    queryFn: () => listNotifications({ page: 1, page_size: 5 }),
    enabled: open,
    staleTime: 15_000,
  });

  const readOne = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: (_data, id) => {
      const now = new Date().toISOString();
      queryClient.setQueriesData<Paginated<AppNotification>>(
        { queryKey: ['notifications', 'list'] },
        (data) =>
          data
            ? {
                ...data,
                items: data.items.map((item) =>
                  item.id === id && item.read_at === null ? { ...item, read_at: now } : item,
                ),
              }
            : data,
      );
      queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, (count) =>
        Math.max(0, (count ?? 1) - 1),
      );
    },
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = t('bell', { count: unread });

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(iconButtonClasses, 'relative')}
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <IconBell />
        {unread > 0 ? (
          <span className="numeric absolute -top-0.5 -right-0.5 min-w-4 rounded-sm bg-accent px-1 text-center text-[10px] leading-4 font-bold text-accent-fg">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('menuTitle')}
          className="panel absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="eyebrow">{t('menuTitle')}</span>
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-bold text-accent-text hover:underline"
            >
              {t('viewAll')}
            </Link>
          </div>
          {recent.isPending ? (
            <p className="px-3 py-4 text-sm text-muted">…</p>
          ) : recent.isError || !recent.data ? (
            <p className="px-3 py-4 text-sm text-down">{t('menuError')}</p>
          ) : recent.data.items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted">{t('emptyTitle')}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {recent.data.items.map((item) => {
                const isUnread = item.read_at === null;
                return (
                  <li key={item.id} className="flex items-start gap-2 px-3 py-2.5">
                    <span
                      aria-label={isUnread ? t('unread') : undefined}
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        isUnread ? 'bg-accent' : 'bg-transparent',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted">
                        {ta(item.type)} · {formatDateTime(item.created_at, timeZone, locale)}
                      </p>
                      <p className={cn('text-sm leading-snug', isUnread && 'font-semibold')}>
                        {describeNotification(item, t, locale)}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <Link
                          href={machinePath(item)}
                          onClick={() => setOpen(false)}
                          className={buttonClasses('ghost', 'sm')}
                        >
                          {t('viewMachine')}
                        </Link>
                        {isUnread ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => readOne.mutate(item.id)}
                            disabled={readOne.isPending}
                          >
                            {t('markRead')}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
