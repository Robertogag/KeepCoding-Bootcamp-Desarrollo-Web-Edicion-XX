import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';
import type { Paginated } from '@/lib/api/types';

interface PagerProps {
  data: Pick<Paginated<unknown>, 'page' | 'page_size' | 'total' | 'has_next' | 'has_prev'>;
  onPage: (page: number) => void;
}

// Paginador con estado local, para listas que no llevan la página en la URL.
export function Pager({ data, onPage }: PagerProps) {
  const t = useTranslations('pagination');
  if (!data.has_prev && !data.has_next) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  return (
    <nav aria-label={t('label')} className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{t('pageOf', { page: data.page, pages })}</span>
      <div className="flex gap-2">
        {data.has_prev ? (
          <Button variant="secondary" size="sm" onClick={() => onPage(data.page - 1)}>
            <IconChevronLeft className="size-4" />
            {t('previous')}
          </Button>
        ) : null}
        {data.has_next ? (
          <Button variant="secondary" size="sm" onClick={() => onPage(data.page + 1)}>
            {t('next')}
            <IconChevronRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
