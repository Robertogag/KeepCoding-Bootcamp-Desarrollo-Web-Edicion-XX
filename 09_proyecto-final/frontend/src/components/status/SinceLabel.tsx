'use client';

import { useNow } from '@/hooks/useNow';
import { formatSince } from '@/lib/format';

export function SinceLabel({ since, className }: { since: string | null; className?: string }) {
  const now = useNow(1000);
  return (
    <span className={className} suppressHydrationWarning>
      {formatSince(since, now)}
    </span>
  );
}
