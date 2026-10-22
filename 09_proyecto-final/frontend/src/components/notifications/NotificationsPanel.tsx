'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Checkbox } from '@/components/form/Field';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button, buttonClasses } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { Link } from '@/i18n/navigation';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import type { AppNotification, Paginated } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { describeNotification, machinePath } from '@/lib/notifications';
import { queryKeys } from '@/lib/query/keys';
import { guessTimeZone } from '@/lib/timezones';

export function NotificationsPanel() {
  const t = useTranslations('notifications');
  const ta = useTranslations('alerts.types');
  const tp = useTranslations('pagination');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const timeZone = guessTimeZone();

  const query = useQuery({
    queryKey: queryKeys.notifications.list(unreadOnly, page),
    queryFn: () => listNotifications({ unread: unreadOnly, page, page_size: 20 }),
    placeholderData: keepPreviousData,
  });
  const unread = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => (await listNotifications({ unread: true, page_size: 1 })).total,
  });

  function markLocally(id: number | null) {
    const now = new Date().toISOString();
    queryClient.setQueriesData<Paginated<AppNotification>>(
      { queryKey: ['notifications', 'list'] },
      (data) =>
        data
          ? {
              ...data,
              items: data.items.map((item) =>
                (id === null || item.id === id) && item.read_at === null
                  ? { ...item, read_at: now }
                  : item,
              ),
            }
          : data,
    );
    queryClient.setQueryData<number>(queryKeys.notifications.unreadCount, (count) =>
      id === null ? 0 : Math.max(0, (count ?? 1) - 1),
    );
  }

  const readOne = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: (_data, id) => {
      markLocally(id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      markLocally(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Checkbox
            label={t('unreadOnly')}
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked);
              setPage(1);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending || (unread.data ?? 0) === 0}
          >
            {t('markAllRead')}
          </Button>
        </div>
      </div>

      <QueryState
        query={query}
        skeleton={
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        }
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState title={t('emptyTitle')} text={t('emptyText')} />}
      >
        {(data) => (
          <div className={cn('space-y-3', query.isPlaceholderData && 'opacity-60')}>
            <ul className="divide-y divide-line panel">
              {data.items.map((item) => {
                const isUnread = item.read_at === null;
                return (
                  <li key={item.id} className="flex flex-wrap items-start gap-3 p-3">
                    <span
                      aria-label={isUnread ? t('unread') : undefined}
                      className={cn(
                        'mt-2 size-2 shrink-0 rounded-full',
                        isUnread ? 'bg-accent' : 'bg-transparent',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {ta(item.type)} · {formatDateTime(item.created_at, timeZone, locale)}
                      </p>
                      <p className={cn('text-sm', isUnread && 'font-medium')}>
                        {describeNotification(item, t, locale)}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Link href={machinePath(item)} className={buttonClasses('ghost', 'sm')}>
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
                  </li>
                );
              })}
            </ul>
            {data.has_prev || data.has_next ? (
              <nav aria-label={tp('label')} className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {tp('pageOf', {
                    page: data.page,
                    pages: Math.max(1, Math.ceil(data.total / data.page_size)),
                  })}
                </span>
                <div className="flex gap-2">
                  {data.has_prev ? (
                    <Button variant="secondary" size="sm" onClick={() => setPage(data.page - 1)}>
                      <IconChevronLeft className="size-4" />
                      {tp('previous')}
                    </Button>
                  ) : null}
                  {data.has_next ? (
                    <Button variant="secondary" size="sm" onClick={() => setPage(data.page + 1)}>
                      {tp('next')}
                      <IconChevronRight className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </div>
        )}
      </QueryState>
    </div>
  );
}
