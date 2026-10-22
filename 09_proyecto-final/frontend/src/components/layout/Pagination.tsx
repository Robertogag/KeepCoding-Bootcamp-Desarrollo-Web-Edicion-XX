import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import type { Paginated } from '@/lib/api/types';

interface PaginationProps {
  data: Pick<Paginated<unknown>, 'page' | 'page_size' | 'total' | 'has_next' | 'has_prev'>;
  hrefFor: (page: number) => string;
}

export function Pagination({ data, hrefFor }: PaginationProps) {
  const t = useTranslations('pagination');
  if (!data.has_prev && !data.has_next) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <nav aria-label={t('label')} className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{t('pageOf', { page: data.page, pages })}</span>
      <div className="flex gap-2">
        {data.has_prev ? (
          <Link href={hrefFor(data.page - 1)} className={buttonClasses('secondary', 'sm')}>
            <IconChevronLeft className="size-4" />
            {t('previous')}
          </Link>
        ) : null}
        {data.has_next ? (
          <Link href={hrefFor(data.page + 1)} className={buttonClasses('secondary', 'sm')}>
            {t('next')}
            <IconChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
