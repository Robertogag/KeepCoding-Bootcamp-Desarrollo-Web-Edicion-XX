import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PublicHeader } from '@/components/layout/PublicHeader';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        {t('skipToContent')}
      </a>
      <PublicHeader />
      <main id="content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted">OEE Live</footer>
    </div>
  );
}
