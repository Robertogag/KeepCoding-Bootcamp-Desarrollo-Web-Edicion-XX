'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { usePlant } from '@/components/plants/PlantContext';
import { ErrorState } from '@/components/state/ErrorState';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { getMachine } from '@/lib/api/machines';
import { queryKeys } from '@/lib/query/keys';
import { MachineForm } from './MachineForm';

function FormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]">
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-1/2" />
      </div>
      <Skeleton className="aspect-[3/2] w-full" />
    </div>
  );
}

export function MachineEditor({ machineId }: { machineId: number }) {
  const { canEdit } = usePlant();
  const t = useTranslations('errors');
  const query = useQuery({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => getMachine(machineId),
  });

  if (!canEdit) return <ErrorState message={t('FORBIDDEN')} />;

  return (
    <QueryState query={query} skeleton={<FormSkeleton />}>
      {(machine) => <MachineForm key={machine.id} machine={machine} />}
    </QueryState>
  );
}
