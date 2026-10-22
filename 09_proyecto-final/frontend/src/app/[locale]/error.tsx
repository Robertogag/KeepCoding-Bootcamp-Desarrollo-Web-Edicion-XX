'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/state/ErrorState';

export default function LocaleError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errorPage');
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <ErrorState title={t('title')} message={t('text')} onRetry={reset} />
    </div>
  );
}
