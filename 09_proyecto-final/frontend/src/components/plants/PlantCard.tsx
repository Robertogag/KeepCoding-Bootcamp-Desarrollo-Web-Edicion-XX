import { useTranslations } from 'next-intl';
import { OeeMetricsRow } from '@/components/oee/OeeMetricsRow';
import { buttonClasses } from '@/components/ui/Button';
import { IconArrowRight } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import type { Plant } from '@/lib/api/types';

export function PlantCard({ plant }: { plant: Plant }) {
  const t = useTranslations('app');
  const tc = useTranslations('common');
  return (
    <article className="panel flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg leading-tight font-semibold">{plant.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {tc('machines', { count: plant.machine_count })} ·{' '}
            {plant.is_public ? t('public') : t('private')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="eyebrow">{t('yourRole')}</p>
          <p className="text-sm font-medium">{t(`role.${plant.role}`)}</p>
        </div>
      </div>
      <OeeMetricsRow metrics={plant.oee_today} />
      <Link
        href={`/app/plants/${plant.id}`}
        className={buttonClasses('secondary', 'sm', 'self-start')}
      >
        {t('openPlant')}
        <IconArrowRight className="size-4" />
      </Link>
    </article>
  );
}
