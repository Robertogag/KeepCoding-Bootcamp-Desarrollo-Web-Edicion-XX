'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ConnectionIndicator } from '@/components/realtime/ConnectionIndicator';
import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { Clock } from '@/components/status/Clock';
import { Button, iconButtonClasses } from '@/components/ui/Button';
import { IconBell, IconFactory, IconLogOut, IconStar, IconUser } from '@/components/ui/icons';
import { NotificationsMenu } from '@/components/notifications/NotificationsMenu';
import { useLogout } from '@/hooks/useLogout';
import { Link, usePathname } from '@/i18n/navigation';
import { countUnread } from '@/lib/api/notifications';
import { useSession } from '@/lib/auth/useSession';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query/keys';
import { guessTimeZone } from '@/lib/timezones';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  href: string;
  key: 'myPlants' | 'watchlist' | 'notifications' | 'profile';
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

const items: NavItem[] = [
  { href: '/app', key: 'myPlants', icon: IconFactory, exact: true },
  { href: '/app/watchlist', key: 'watchlist', icon: IconStar },
  { href: '/app/notifications', key: 'notifications', icon: IconBell },
  { href: '/app/profile', key: 'profile', icon: IconUser },
];

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'text-base font-black tracking-[0.14em] whitespace-nowrap uppercase',
        className,
      )}
    >
      OEE <span className="text-accent-text">Live</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { user } = useSession();
  const { logout, pending: loggingOut } = useLogout();
  const { status } = useRealtime();
  const timeZone = guessTimeZone();
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: countUnread,
    enabled: user !== null,
    staleTime: 60_000,
  });
  const unread = unreadQuery.data ?? 0;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        {tc('skipToContent')}
      </a>

      <aside className="header-bar hidden w-56 shrink-0 flex-col border-r border-line-strong md:flex">
        <div className="flex h-14 flex-col justify-center border-b border-line px-4">
          <Brand />
        </div>
        <nav aria-label={t('main')} className="flex flex-1 flex-col gap-0.5 py-2">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 border-l-2 px-4 py-2 text-sm font-bold transition-colors',
                  active
                    ? 'border-accent-text bg-panel-2 text-accent-text'
                    : 'border-transparent text-muted hover:bg-panel-2 hover:text-fg',
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        {user ? (
          <div className="flex items-center gap-2 border-t border-line p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{user.full_name}</p>
              <p className="numeric truncate text-xs text-muted">@{user.username}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              disabled={loggingOut}
              aria-label={t('logout')}
              title={t('logout')}
            >
              <IconLogOut className="size-5" />
            </Button>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="header-bar sticky top-0 z-20 flex h-14 items-center gap-2 px-4">
          <Brand className="md:hidden" />
          <div className="ml-auto flex items-center gap-1">
            <Clock
              timeZone={timeZone}
              className="numeric mr-3 hidden text-sm font-bold text-fg sm:inline"
            />
            <ConnectionIndicator status={status} className="mr-2" />
            <LocaleSwitcher />
            <ThemeToggle />
            <NotificationsMenu unread={unread} className="hidden md:block" />
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className={cn(iconButtonClasses, 'md:hidden')}
              aria-label={t('logout')}
              title={t('logout')}
            >
              <IconLogOut />
            </button>
          </div>
        </header>

        <main id="content" className="flex-1 p-4 pb-24 md:p-6">
          {children}
        </main>

        <nav
          aria-label={t('main')}
          className="header-bar fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line-strong md:hidden"
        >
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 border-t-2 py-2 text-xs font-bold',
                  active ? 'border-accent-text text-accent-text' : 'border-transparent text-muted',
                )}
              >
                <item.icon className="size-5" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
