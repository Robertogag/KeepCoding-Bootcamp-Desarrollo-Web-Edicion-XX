'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { RealtimeStatus } from '@/lib/realtime/client';

const dots: Record<RealtimeStatus, string> = {
  live: 'bg-running',
  reconnecting: 'bg-idle animate-pulse',
  offline: 'bg-offline',
};

export function ConnectionIndicator({
  status,
  className,
}: {
  status: RealtimeStatus;
  className?: string;
}) {
  const t = useTranslations('realtime');
  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] whitespace-nowrap text-muted uppercase',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('inline-block size-2 rounded-full', dots[status])} />
      {t(status)}
    </span>
  );
}
