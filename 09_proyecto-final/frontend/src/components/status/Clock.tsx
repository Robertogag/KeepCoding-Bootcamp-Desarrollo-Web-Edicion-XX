'use client';

import { useLocale } from 'next-intl';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/format';

export function Clock({ timeZone, className }: { timeZone: string; className?: string }) {
  const locale = useLocale();
  const now = useNow(1000);
  return (
    <span className={className} suppressHydrationWarning>
      {formatClock(now, timeZone, locale)}
    </span>
  );
}
