'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { MachineCard } from '@/components/machines/MachineCard';
import { MetricBars } from '@/components/oee/MetricBars';
import { OeeGauge } from '@/components/oee/OeeGauge';
import { EmptyState } from '@/components/state/EmptyState';
import { ErrorState } from '@/components/state/ErrorState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton, SkeletonCardGrid } from '@/components/state/Skeleton';
import { StateCounters } from '@/components/status/StateCounters';
import { buttonClasses } from '@/components/ui/Button';
import { IconPlus } from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { Link } from '@/i18n/navigation';
import { getPlantBoard } from '@/lib/api/injection';
import { listMachines } from '@/lib/api/machines';
import type { MachineFilters } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query/keys';
import { usePlant } from './PlantContext';
import { PlantLayoutView } from './PlantLayoutView';

const BOARD_FILTERS: MachineFilters = { page_size: 100 };
const VIEW_KEY = 'oee.boardView';
type View = 'plant' | 'cards';

const listeners = new Set<() => void>();

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'plant';
  } catch {
    return 'plant';
  }
}

function writeView(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // El almacenamiento del navegador es solo una comodidad.
  }
  for (const listener of listeners) listener();
}

// La vista elegida se recuerda por navegador; en el servidor se parte de la vista de planta.
function useBoardView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readView,
    () => 'plant' as View,
  );
  return [view, writeView];
}

function ViewToggle({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  const t = useTranslations('layout');
  return (
    <div
      role="group"
      aria-label={t('view')}
      className="flex rounded-md border border-line-strong p-0.5"
    >
      {(['plant', 'cards'] as View[]).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={view === item}
          onClick={() => onChange(item)}
          className={cn(
            'rounded px-3 py-1 text-[11px] font-extrabold tracking-[0.08em] uppercase',
            view === item ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
          )}
        >
          {t(item)}
        </button>
      ))}
    </div>
  );
}

export function PlantBoard() {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('machines');
  const tp = useTranslations('publicPlant');
  const describe = useErrorMessage();
  const now = useNow(1000);
  const { status } = useRealtime();
  const [view, setView] = useBoardView();
  const board = useQuery({
    queryKey: ['plants', plant.id, 'board'],
    queryFn: () => getPlantBoard(plant.id),
    refetchInterval: 10_000,
  });
  const machines = useQuery({
    queryKey: queryKeys.machines.list(plant.id, BOARD_FILTERS),
    queryFn: () => listMachines(plant.id, BOARD_FILTERS),
    refetchInterval: status === 'live' ? 60_000 : 15_000,
    enabled: view === 'cards',
  });
  const runOf = (machineId: number) =>
    board.data?.machines.find((machine) => machine.id === machineId)?.current_run ?? null;

  if (view === 'plant') {
    if (board.isPending) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }
    if (board.isError) {
      return (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ViewToggle view={view} onChange={setView} />
          </div>
          <ErrorState message={describe(board.error)} onRetry={() => void board.refetch()} />
        </div>
      );
    }
    if (board.data.machines.length === 0) {
      return (
        <EmptyState
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            canEdit ? (
              <Link
                href={`/app/plants/${plant.id}/machines/new`}
                className={buttonClasses('primary', 'sm')}
              >
                <IconPlus className="size-4" />
                {t('new')}
              </Link>
            ) : undefined
          }
        />
      );
    }
    return (
      <PlantLayoutView
        board={board.data}
        plantId={plant.id}
        now={now}
        toolbar={<ViewToggle view={view} onChange={setView} />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="plant-oee"
        className="panel flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-4"
      >
        <div className="flex items-center gap-5">
          <OeeGauge value={plant.oee_today.oee} size={104} stroke={9} label="OEE" />
          <div className="min-w-56">
            <h2 id="plant-oee" className="eyebrow">
              {tp('plantOee')}
            </h2>
            <MetricBars metrics={plant.oee_today} className="mt-2" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ViewToggle view={view} onChange={setView} />
          <StateCounters machines={machines.data?.items ?? null} />
        </div>
      </section>

      <QueryState
        query={machines}
        skeleton={<SkeletonCardGrid count={6} />}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            title={t('emptyTitle')}
            text={t('emptyText')}
            action={
              canEdit ? (
                <Link
                  href={`/app/plants/${plant.id}/machines/new`}
                  className={buttonClasses('primary', 'sm')}
                >
                  <IconPlus className="size-4" />
                  {t('new')}
                </Link>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.items.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                href={`/app/plants/${plant.id}/machines/${machine.id}`}
                now={now}
                run={board.data ? runOf(machine.id) : undefined}
              />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
