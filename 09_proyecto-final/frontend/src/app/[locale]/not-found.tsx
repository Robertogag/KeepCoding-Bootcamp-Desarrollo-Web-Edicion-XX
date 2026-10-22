import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-2 text-muted">{t('text')}</p>
      <Link href="/" className={buttonClasses('secondary', 'md', 'mt-6')}>
        {t('home')}
      </Link>
    </div>
  );
}
