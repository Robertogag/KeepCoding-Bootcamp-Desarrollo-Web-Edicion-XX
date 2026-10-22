'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { usePlant } from '@/components/plants/PlantContext';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/icons';
import { usePathname, useRouter } from '@/i18n/navigation';
import { listResinLots } from '@/lib/api/injection';
import type { Mold, Product, ProductionLine, Recipe, Resin, ResinLot } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatDate, formatDecimal, formatInteger } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import {
  LineDialog,
  LotDialog,
  MoldDialog,
  ProductDialog,
  RecipeDialog,
  ResinDialog,
} from './CatalogDialogs';
import { CatalogTable, type CatalogColumn } from './CatalogTable';
import { labelOf, useCatalog } from './useCatalog';

type Tab = 'lines' | 'products' | 'molds' | 'resins' | 'recipes' | 'lots';
const TABS: Tab[] = ['lines', 'products', 'molds', 'resins', 'recipes', 'lots'];

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function stateColumn<T extends { is_active: boolean }>(
  t: (key: string) => string,
): CatalogColumn<T> {
  return {
    key: 'state',
    label: t('state'),
    render: (item) => (item.is_active ? t('active') : t('inactive')),
  };
}

function SectionHeader({
  newLabel,
  onNew,
  canEdit,
}: {
  newLabel: string;
  onNew: () => void;
  canEdit: boolean;
}) {
  const t = useTranslations('catalogs');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">{canEdit ? '' : t('readOnly')}</p>
      {canEdit ? (
        <Button size="sm" onClick={onNew}>
          <IconPlus className="size-4" />
          {newLabel}
        </Button>
      ) : null}
    </div>
  );
}

function LinesSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const query = useCatalog(plantId, 'production-lines');
  const [editing, setEditing] = useState<ProductionLine | 'new' | null>(null);
  const columns: CatalogColumn<ProductionLine>[] = [
    { key: 'code', label: tc('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: tc('name'), render: (item) => item.name },
    stateColumn(tc),
  ];
  return (
    <div className="space-y-3">
      <SectionHeader newLabel={t('new.lines')} onNew={() => setEditing('new')} canEdit={canEdit} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <LineDialog
          plantId={plantId}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ProductsSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const locale = useLocale();
  const query = useCatalog(plantId, 'products');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const columns: CatalogColumn<Product>[] = [
    { key: 'code', label: tc('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: tc('name'), render: (item) => item.name },
    {
      key: 'weight',
      label: tc('partWeight'),
      render: (item) => formatDecimal(item.part_weight_g, locale),
      align: 'right',
      numeric: true,
    },
    {
      key: 'description',
      label: tc('description'),
      render: (item) => item.description,
      hideOnMobile: true,
    },
    stateColumn(tc),
  ];
  return (
    <div className="space-y-3">
      <SectionHeader
        newLabel={t('new.products')}
        onNew={() => setEditing('new')}
        canEdit={canEdit}
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <ProductDialog
          plantId={plantId}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function MoldsSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const query = useCatalog(plantId, 'molds');
  const [editing, setEditing] = useState<Mold | 'new' | null>(null);
  const columns: CatalogColumn<Mold>[] = [
    { key: 'code', label: tc('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: tc('name'), render: (item) => item.name },
    {
      key: 'cavities',
      label: tc('cavities'),
      render: (item) => item.nominal_cavities,
      align: 'right',
      numeric: true,
    },
    stateColumn(tc),
  ];
  return (
    <div className="space-y-3">
      <SectionHeader newLabel={t('new.molds')} onNew={() => setEditing('new')} canEdit={canEdit} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <MoldDialog
          plantId={plantId}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ResinsSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const query = useCatalog(plantId, 'resins');
  const [editing, setEditing] = useState<Resin | 'new' | null>(null);
  const columns: CatalogColumn<Resin>[] = [
    { key: 'code', label: tc('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: tc('name'), render: (item) => item.name },
    { key: 'polymer', label: tc('polymer'), render: (item) => item.polymer },
    { key: 'grade', label: tc('grade'), render: (item) => item.grade, hideOnMobile: true },
    {
      key: 'manufacturer',
      label: tc('manufacturer'),
      render: (item) => item.manufacturer,
      hideOnMobile: true,
    },
    stateColumn(tc),
  ];
  return (
    <div className="space-y-3">
      <SectionHeader newLabel={t('new.resins')} onNew={() => setEditing('new')} canEdit={canEdit} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <ResinDialog
          plantId={plantId}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function RecipesSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const locale = useLocale();
  const query = useCatalog(plantId, 'injection-recipes');
  const products = useCatalog(plantId, 'products');
  const molds = useCatalog(plantId, 'molds');
  const resins = useCatalog(plantId, 'resins');
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const unknown = (id: number) => t('unknown', { id });
  const columns: CatalogColumn<Recipe>[] = [
    { key: 'code', label: tc('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: tc('name'), render: (item) => item.name },
    {
      key: 'product',
      label: tc('product'),
      render: (item) => labelOf(products.data, item.product_id, unknown(item.product_id)),
    },
    {
      key: 'mold',
      label: tc('mold'),
      render: (item) => labelOf(molds.data, item.mold_id, unknown(item.mold_id)),
      hideOnMobile: true,
    },
    {
      key: 'resin',
      label: tc('resin'),
      render: (item) => labelOf(resins.data, item.resin_id, unknown(item.resin_id)),
      hideOnMobile: true,
    },
    {
      key: 'cycle',
      label: tc('idealCycle'),
      render: (item) => formatDecimal(item.ideal_cycle_s, locale),
      align: 'right',
      numeric: true,
    },
    {
      key: 'cavities',
      label: tc('activeCavities'),
      render: (item) => item.active_cavities,
      align: 'right',
      numeric: true,
    },
    stateColumn(tc),
  ];
  return (
    <div className="space-y-3">
      <SectionHeader
        newLabel={t('new.recipes')}
        onNew={() => setEditing('new')}
        canEdit={canEdit}
      />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(items) => (
          <CatalogTable
            items={items}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {editing ? (
        <RecipeDialog
          plantId={plantId}
          item={editing === 'new' ? undefined : editing}
          products={products.data ?? []}
          molds={molds.data ?? []}
          resins={resins.data ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function LotsSection({ plantId, canEdit }: { plantId: number; canEdit: boolean }) {
  const t = useTranslations('catalogs');
  const tc = useTranslations('catalogs.columns');
  const locale = useLocale();
  const { plant } = usePlant();
  const resins = useCatalog(plantId, 'resins');
  const filters = { page_size: 100 };
  const query = useQuery({
    queryKey: queryKeys.injection.lots(plantId, filters),
    queryFn: () => listResinLots(plantId, filters),
  });
  const [creating, setCreating] = useState(false);
  const columns: CatalogColumn<ResinLot>[] = [
    { key: 'lot', label: tc('lotCode'), render: (item) => item.lot_code, numeric: true },
    {
      key: 'resin',
      label: tc('resin'),
      render: (item) => labelOf(resins.data, item.resin_id, t('unknown', { id: item.resin_id })),
    },
    {
      key: 'kg',
      label: tc('receivedKg'),
      render: (item) => formatInteger(Math.round(item.received_kg), locale),
      align: 'right',
      numeric: true,
    },
    {
      key: 'received',
      label: tc('receivedAt'),
      render: (item) => formatDate(item.received_at, plant.timezone, locale),
      numeric: true,
    },
  ];
  return (
    <div className="space-y-3">
      <SectionHeader newLabel={t('new.lots')} onNew={() => setCreating(true)} canEdit={canEdit} />
      <QueryState query={query} skeleton={<TableSkeleton />}>
        {(data) => (
          <CatalogTable
            items={data.items}
            columns={columns}
            emptyTitle={t('empty')}
            emptyText={canEdit ? t('emptyText') : undefined}
          />
        )}
      </QueryState>
      {creating ? (
        <LotDialog
          plantId={plantId}
          resins={resins.data ?? []}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}

function CatalogsTabs() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('catalogs');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = searchParams.get('tab');
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : 'lines';

  function select(next: Tab) {
    router.replace(next === 'lines' ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label={t('title')}
        className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
      >
        <div className="flex min-w-max gap-1 rounded-md border border-line p-0.5">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              onClick={() => select(item)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium tracking-[0.08em] uppercase',
                tab === item ? 'bg-panel-2 text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {t(`resources.${item}`)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'lines' ? <LinesSection plantId={plant.id} canEdit={canEdit} /> : null}
      {tab === 'products' ? <ProductsSection plantId={plant.id} canEdit={canEdit} /> : null}
      {tab === 'molds' ? <MoldsSection plantId={plant.id} canEdit={canEdit} /> : null}
      {tab === 'resins' ? <ResinsSection plantId={plant.id} canEdit={canEdit} /> : null}
      {tab === 'recipes' ? <RecipesSection plantId={plant.id} canEdit={canEdit} /> : null}
      {tab === 'lots' ? <LotsSection plantId={plant.id} canEdit={canEdit} /> : null}
    </div>
  );
}

export function CatalogsPanel() {
  const t = useTranslations('catalogs');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{t('subtitle')}</p>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        <CatalogsTabs />
      </Suspense>
    </div>
  );
}
