'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/useSession';

export function AppGate({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Tras un cierre voluntario, quien cerró la sesión decide a dónde ir; aquí solo se cubre el vencimiento.
    if (session.status === 'anonymous' && session.reason !== 'signout') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.status, session.reason, pathname, router]);

  if (session.status !== 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <Spinner className="size-6 text-muted" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  return <>{children}</>;
}
