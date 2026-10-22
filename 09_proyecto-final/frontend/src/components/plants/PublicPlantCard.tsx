import { useTranslations } from 'next-intl';
import { OeeMetricsRow } from '@/components/oee/OeeMetricsRow';
import { buttonClasses } from '@/components/ui/Button';
import { IconArrowRight } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import type { PublicPlantListItem } from '@/lib/api/types';

export function PublicPlantCard({ plant }: { plant: PublicPlantListItem }) {
  const t = useTranslations('landing');
  const tc = useTranslations('common');
  return (
    <article className="panel flex flex-col gap-4 p-4">
      <div>
        <h3 className="truncate text-lg leading-tight font-semibold">{plant.name}</h3>
        <p className="mt-1 text-sm text-muted">
          <span className="numeric">{plant.timezone}</span> ·{' '}
          {tc('machines', { count: plant.machine_count })}
        </p>
      </div>
      <OeeMetricsRow metrics={plant.oee_today} />
      <Link
        href={`/plants/${plant.slug}`}
        className={buttonClasses('secondary', 'sm', 'self-start')}
      >
        {t('openPlant')}
        <IconArrowRight className="size-4" />
      </Link>
    </article>
  );
}
