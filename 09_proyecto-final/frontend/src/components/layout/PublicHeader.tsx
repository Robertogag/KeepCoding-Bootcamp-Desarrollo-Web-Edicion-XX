import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Brand } from './AppShell';
import { HeaderSession } from './HeaderSession';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';

export function PublicHeader() {
  const t = useTranslations('nav');
  return (
    <header className="header-bar sticky top-0 z-20">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="inline-flex items-center">
          <Brand />
        </Link>
        <nav aria-label={t('main')} className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <HeaderSession />
        </nav>
      </div>
    </header>
  );
}
