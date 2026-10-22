'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { GuidePanel } from '@/components/guide/GuidePanel';
import { PlantCard } from '@/components/plants/PlantCard';
import { EmptyState } from '@/components/state/EmptyState';
import { QueryState } from '@/components/state/QueryState';
import { SkeletonCardGrid } from '@/components/state/Skeleton';
import { buttonClasses } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { listPlants } from '@/lib/api/plants';
import { queryKeys } from '@/lib/query/keys';

export default function MyPlantsPage() {
  const t = useTranslations('app');
  const query = useQuery({ queryKey: queryKeys.plants.list(1), queryFn: () => listPlants(1) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('myPlants')}</h1>
        <Link href="/app/plants/new" className={buttonClasses('primary', 'sm')}>
          <IconPlus className="size-4" />
          {t('newPlant')}
        </Link>
      </div>

      <GuidePanel compact />

      <QueryState
        query={query}
        skeleton={<SkeletonCardGrid count={3} />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            title={t('noPlantsTitle')}
            text={t('noPlantsText')}
            action={
              <Link href="/app/plants/new" className={buttonClasses('primary', 'sm')}>
                <IconPlus className="size-4" />
                {t('newPlant')}
              </Link>
            }
          />
        }
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((plant) => (
              <PlantCard key={plant.id} plant={plant} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
