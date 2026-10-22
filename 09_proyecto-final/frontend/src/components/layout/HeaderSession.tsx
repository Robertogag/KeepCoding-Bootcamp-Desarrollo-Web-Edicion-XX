'use client';

import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { useSession } from '@/lib/auth/useSession';

export function HeaderSession() {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const session = useSession();

  if (session.status === 'authenticated') {
    return (
      <Link href="/app" className={buttonClasses('primary', 'sm')}>
        {tAuth('myPanel')}
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className={buttonClasses('ghost', 'sm')}>
        {t('login')}
      </Link>
      <Link href="/register" className={buttonClasses('primary', 'sm', 'hidden sm:inline-flex')}>
        {t('register')}
      </Link>
    </>
  );
}
