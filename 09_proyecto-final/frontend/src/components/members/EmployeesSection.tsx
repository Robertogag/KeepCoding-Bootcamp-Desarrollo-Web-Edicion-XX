'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmployeeDialog } from '@/components/catalogs/CatalogDialogs';
import { CatalogTable, type CatalogColumn } from '@/components/catalogs/CatalogTable';
import { useCatalog } from '@/components/catalogs/useCatalog';
import { usePlant } from '@/components/plants/PlantContext';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/icons';
import { listMembers } from '@/lib/api/plants';
import type { Employee } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';

// Empleados asignables a corridas: personas de piso, con o sin cuenta en OEE Live.
export function EmployeesSection() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('members.employees');
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const employees = useCatalog(plant.id, 'employees');
  const members = useQuery({
    queryKey: queryKeys.plants.members(plant.id),
    queryFn: () => listMembers(plant.id),
  });
  const accountOf = (userId: number | null) => {
    if (userId === null) return t('noAccount');
    const member = members.data?.items.find((item) => item.user_id === userId);
    return member ? `${member.full_name} · @${member.username}` : `#${userId}`;
  };
  const columns: CatalogColumn<Employee>[] = [
    { key: 'code', label: t('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: t('name'), render: (item) => item.name },
    { key: 'account', label: t('account'), render: (item) => accountOf(item.user_id) },
    {
      key: 'state',
      label: t('active'),
      render: (item) => (item.is_active ? t('active') : t('inactive')),
    },
  ];

  return (
    <section className="space-y-3 border-t border-line pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{t('title')}</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <IconPlus className="size-4" />
            {t('new')}
          </Button>
        ) : null}
      </div>
      <QueryState query={employees} skeleton={<Skeleton className="h-24 w-full" />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
          />
        )}
      </QueryState>
      {editing ? (
        <EmployeeDialog
          plantId={plant.id}
          item={editing === 'new' ? undefined : editing}
          members={members.data?.items ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
