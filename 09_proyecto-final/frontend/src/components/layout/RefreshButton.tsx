'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { PendingButton } from '@/components/state/PendingButton';
import { IconRefresh } from '@/components/ui/icons';

export function RefreshButton() {
  const t = useTranslations('state');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <PendingButton
      variant="secondary"
      size="sm"
      pending={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {!pending ? <IconRefresh className="size-4" /> : null}
      {t('retry')}
    </PendingButton>
  );
}
