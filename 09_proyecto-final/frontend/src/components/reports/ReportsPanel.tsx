'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { OeeTrendChart } from '@/components/charts/OeeTrendChart';
import { Input } from '@/components/form/Field';
import { MetricBars } from '@/components/oee/MetricBars';
import { OeeGauge } from '@/components/oee/OeeGauge';
import { OeeHelp } from '@/components/oee/OeeHelp';
import { usePlant } from '@/components/plants/PlantContext';
import { EmptyState } from '@/components/state/EmptyState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/hooks/useNow';
import { getPlantBoard } from '@/lib/api/injection';
import { listMachines } from '@/lib/api/machines';
import { getPlantSummary } from '@/lib/api/oee';
import { cn } from '@/lib/cn';
import { listDays, rowsFromDaySummaries, toOeeCsv } from '@/lib/csv';
import {
  EMPTY_VALUE,
  formatDecimal,
  formatDuration,
  formatInteger,
  formatPercent,
} from '@/lib/format';
import { oeeLevel } from '@/lib/oee-level';
import { queryKeys } from '@/lib/query/keys';
import {
  aggregateAll,
  aggregateByDay,
  aggregateByMachine,
  aggregateMatrix,
  matrixKey,
  type ReportLike,
} from '@/lib/reports';
import { addDays, localDayKey } from '@/lib/time';

const ALL_MACHINES = { page_size: 100 };
const levelText = { good: 'text-running', warn: 'text-idle', bad: 'text-down' } as const;

type View = 'machine' | 'day' | 'matrix';
const VIEWS: View[] = ['machine', 'day', 'matrix'];

function Percent({ value, bold = false }: { value: number | null; bold?: boolean }) {
  const locale = useLocale();
  const level = oeeLevel(value);
  return (
    <td
      className={cn(
        'numeric px-3 py-2 text-right',
        bold && 'font-bold',
        level ? levelText[level] : 'text-muted',
      )}
    >
      {formatPercent(value, locale)}
    </td>
  );
}

function MetricCells({ totals }: { totals: ReportLike }) {
  const locale = useLocale();
  const to = useTranslations('oee');
  const performanceLevel = oeeLevel(totals.performance);
  return (
    <>
      <Percent value={totals.oee} bold />
      <Percent value={totals.availability} />
      <td
        className={cn(
          'numeric px-3 py-2 text-right',
          performanceLevel ? levelText[performanceLevel] : 'text-muted',
        )}
        title={totals.capped ? to('performance') : undefined}
      >
        {formatPercent(totals.performance, locale)}
        {totals.capped ? <span className="text-idle"> ≤</span> : null}
      </td>
      <Percent value={totals.quality} />
      <td className="numeric px-3 py-2 text-right">{formatInteger(totals.good, locale)}</td>
      <td className={cn('numeric px-3 py-2 text-right', totals.reject > 0 && 'text-down')}>
        {formatInteger(totals.reject, locale)}
      </td>
      <td className="numeric hidden px-3 py-2 text-right md:table-cell">
        {formatDuration(totals.run_s)}
      </td>
      <td className="numeric hidden px-3 py-2 text-right md:table-cell">
        {formatDuration(totals.planned_s)}
      </td>
    </>
  );
}

function MetricHeaders() {
  const to = useTranslations('oee');
  const tc = useTranslations('chart');
  const head = 'px-3 py-2 text-right font-medium';
  return (
    <>
      <th className={head}>{to('oee')}</th>
      <th className={head} title={to('availability')}>
        {to('availabilityShort')}
      </th>
      <th className={head} title={to('performance')}>
        {to('performanceShort')}
      </th>
      <th className={head} title={to('quality')}>
        {to('qualityShort')}
      </th>
      <th className={head}>{tc('good')}</th>
      <th className={head}>{tc('reject')}</th>
      <th className={cn(head, 'hidden md:table-cell')}>{tc('run')}</th>
      <th className={cn(head, 'hidden md:table-cell')}>{tc('planned')}</th>
    </>
  );
}

// Consulta de datos: un resumen de planta por día local (se piden en paralelo y se guardan en caché),
// filtrado por máquinas y mostrado por máquina, por día o día × máquina. El CSV y el Excel salen de
// las mismas filas, así que descargan al instante.
export function ReportsPanel() {
  const { plant } = usePlant();
  const t = useTranslations('reports');
  const tc = useTranslations('chart');
  const locale = useLocale();
  const toast = useToast();
  const describe = useErrorMessage();
  const now = useNow(60_000);
  const today = localDayKey(now, plant.timezone);
  const [fromDay, setFromDay] = useState(() =>
    localDayKey(addDays(Date.now(), -6), plant.timezone),
  );
  const [toDay, setToDay] = useState(() => localDayKey(Date.now(), plant.timezone));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [view, setView] = useState<View>('machine');
  const [exporting, setExporting] = useState(false);

  const days = useMemo(() => listDays(fromDay, toDay), [fromDay, toDay]);
  const valid = fromDay !== '' && toDay !== '' && fromDay <= toDay && days.length > 0;

  const machines = useQuery({
    queryKey: queryKeys.machines.list(plant.id, ALL_MACHINES),
    queryFn: () => listMachines(plant.id, ALL_MACHINES),
  });
  const board = useQuery({
    queryKey: ['plants', plant.id, 'board'],
    queryFn: () => getPlantBoard(plant.id),
    staleTime: 30_000,
  });
  const machineNames = useMemo(
    () =>
      (machines.data?.items ?? [])
        .map((machine) => machine.name)
        .sort((a, b) => a.localeCompare(b)),
    [machines.data],
  );
  const idealCycles = useMemo(
    () =>
      new Map((machines.data?.items ?? []).map((machine) => [machine.name, machine.ideal_cycle_s])),
    [machines.data],
  );

  const summaries = useQueries({
    queries: days.map((day) => ({
      queryKey: ['plants', plant.id, 'oee-summary', day] as const,
      queryFn: () => getPlantSummary(plant.id, day),
      // Un día cerrado ya no cambia; el día en curso se refresca al volver a la pantalla.
      staleTime: day < today ? Number.POSITIVE_INFINITY : 60_000,
      enabled: valid,
    })),
  });
  const loaded = summaries.filter((query) => query.data).length;
  const pending = summaries.some((query) => query.isPending);
  const failed = summaries.find((query) => query.isError);

  const allRows = rowsFromDaySummaries(
    days.flatMap((day, index) => {
      const data = summaries[index]?.data;
      return data ? [{ date: day, machines: data.machines }] : [];
    }),
  );
  const filteredRows = selected ? allRows.filter((row) => selected.has(row.machine)) : allRows;
  const totals = loaded > 0 ? aggregateAll(filteredRows, idealCycles) : null;
  const noMachineSelected = selected !== null && selected.size === 0;

  function preset(count: number) {
    setFromDay(localDayKey(addDays(Date.now(), -(count - 1)), plant.timezone));
    setToDay(today);
  }

  function toggleMachine(name: string) {
    setSelected((current) => {
      const next = new Set(current ?? machineNames);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      if (next.size === machineNames.length) return null;
      return next;
    });
  }

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    if (loaded === 0) return;
    saveBlob(
      new Blob([toOeeCsv(filteredRows)], { type: 'text/csv;charset=utf-8' }),
      `oee_${plant.slug}_${fromDay}_${toDay}.csv`,
    );
  }

  async function downloadExcel() {
    if (loaded === 0 || exporting) return;
    setExporting(true);
    try {
      const { buildOeeWorkbook } = await import('@/lib/excel');
      const blob = await buildOeeWorkbook({
        plantName: plant.name,
        timeZone: plant.timezone,
        fromDay,
        toDay,
        allMachines: selected === null,
        machines: selected ? [...selected].sort((a, b) => a.localeCompare(b)) : machineNames,
        rows: filteredRows,
        idealCycles,
        locale,
        generatedAt: new Date(),
      });
      saveBlob(blob, `oee_${plant.slug}_${fromDay}_${toDay}.xlsx`);
    } catch {
      toast({ title: t('excelFailed'), variant: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const ready = loaded > 0 && !noMachineSelected;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{t('title')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OeeHelp totals={totals} />
          <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={!ready || pending}>
            {t('download')}
          </Button>
          <Button size="sm" onClick={downloadExcel} disabled={!ready || pending || exporting}>
            {exporting ? t('exporting') : t('excel')}
          </Button>
        </div>
      </div>

      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <span className="eyebrow w-full md:w-24">{t('range')}</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => preset(1)}>
              {t('presets.today')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => preset(7)}>
              {t('presets.week')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => preset(30)}>
              {t('presets.month')}
            </Button>
          </div>
          <label className="text-sm text-muted">
            {t('from')}
            <Input
              type="date"
              value={fromDay}
              max={toDay}
              onChange={(e) => setFromDay(e.target.value)}
              className="mt-1 w-auto"
            />
          </label>
          <label className="text-sm text-muted">
            {t('to')}
            <Input
              type="date"
              value={toDay}
              min={fromDay}
              max={today}
              onChange={(e) => setToDay(e.target.value)}
              className="mt-1 w-auto"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow w-full md:w-24">{t('machines')}</span>
          <button
            type="button"
            aria-pressed={selected === null}
            onClick={() => setSelected(null)}
            className={cn(
              'chip cursor-pointer',
              selected === null ? 'text-accent-text' : 'text-muted',
            )}
          >
            {t('all')}
          </button>
          {machineNames.map((name) => {
            const active = selected === null || selected.has(name);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => toggleMachine(name)}
                className={cn('chip cursor-pointer', active ? 'text-fg' : 'text-muted opacity-60')}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow w-full md:w-24">{t('view')}</span>
          <div className="inline-flex rounded-md border border-line-strong p-0.5">
            {VIEWS.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'rounded px-3 py-1.5 text-[12px] font-bold tracking-[0.08em] uppercase',
                  view === key ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {t(`views.${key}`)}
              </button>
            ))}
          </div>
          {pending && valid ? (
            <span className="numeric ml-auto text-xs text-muted" role="status">
              {t('loadingDays', { loaded, total: days.length })}
            </span>
          ) : null}
        </div>
      </section>

      {!valid ? (
        <p role="alert" className="text-sm text-down">
          {t('invalidRange')}
        </p>
      ) : noMachineSelected ? (
        <EmptyState title={t('noMachinesTitle')} text={t('noMachinesText')} />
      ) : loaded === 0 && failed ? (
        <EmptyState
          title={t('loadFailed')}
          text={describe(failed.error)}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => summaries.forEach((query) => void query.refetch())}
            >
              {t('retry')}
            </Button>
          }
        />
      ) : loaded === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : filteredRows.length === 0 && !pending ? (
        <EmptyState title={t('emptyTitle')} text={t('emptyText')} />
      ) : (
        (() => {
          const range = aggregateAll(filteredRows, idealCycles);
          const byDay = aggregateByDay(filteredRows, idealCycles, plant.timezone);
          const perMachine = aggregateByMachine(filteredRows, idealCycles);
          const matrix = aggregateMatrix(filteredRows, idealCycles);
          const dayTotals = new Map(byDay.map((row) => [row.bucket_start.slice(0, 10), row]));
          return (
            <div className={cn('space-y-4', pending && 'opacity-80')}>
              <section className="panel flex flex-wrap items-center gap-6 p-4">
                <OeeGauge value={range.oee} size={112} stroke={10} label="OEE" />
                <div className="min-w-60 flex-1">
                  <h3 className="eyebrow">{t('rangeOee')}</h3>
                  <MetricBars metrics={range} className="mt-2 max-w-md" />
                  <p className="numeric mt-3 text-sm text-muted">
                    {tc('good')}{' '}
                    <span className="font-bold text-fg">{formatInteger(range.good, locale)}</span> ·{' '}
                    {tc('reject')}{' '}
                    <span className="font-bold text-fg">{formatInteger(range.reject, locale)}</span>{' '}
                    · {tc('run')}{' '}
                    <span className="font-bold text-fg">{formatDuration(range.run_s)}</span> ·{' '}
                    {tc('planned')}{' '}
                    <span className="font-bold text-fg">{formatDuration(range.planned_s)}</span> (
                    {t('machineHours')})
                  </p>
                </div>
              </section>

              <section className="panel overflow-x-auto">
                {view === 'machine' ? (
                  <table className="w-full text-sm">
                    <caption className="eyebrow px-3 py-2 text-left">{t('byMachine')}</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">{t('machine')}</th>
                        <MetricHeaders />
                      </tr>
                    </thead>
                    <tbody>
                      {perMachine.map((row) => (
                        <tr key={row.machine} className="border-b border-line/60">
                          <td className="px-3 py-2 font-bold">{row.machine}</td>
                          <MetricCells totals={row} />
                        </tr>
                      ))}
                      <tr className="bg-panel-2/60 font-bold">
                        <td className="px-3 py-2">{t('total')}</td>
                        <MetricCells totals={range} />
                      </tr>
                    </tbody>
                  </table>
                ) : view === 'day' ? (
                  <table className="w-full text-sm">
                    <caption className="eyebrow px-3 py-2 text-left">{t('byDay')}</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">{t('date')}</th>
                        <MetricHeaders />
                      </tr>
                    </thead>
                    <tbody>
                      {byDay.map((row) => (
                        <tr key={row.bucket_start} className="border-b border-line/60">
                          <td className="numeric px-3 py-2 font-bold">
                            {row.bucket_start.slice(0, 10)}
                          </td>
                          <MetricCells totals={row} />
                        </tr>
                      ))}
                      <tr className="bg-panel-2/60 font-bold">
                        <td className="px-3 py-2">{t('total')}</td>
                        <MetricCells totals={range} />
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <caption className="eyebrow px-3 py-2 text-left">{t('views.matrix')}</caption>
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">{t('date')}</th>
                        {matrix.machines.map((machine) => (
                          <th key={machine} className="px-3 py-2 text-right font-medium">
                            {machine}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right font-medium">{t('total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.days.map((day) => (
                        <tr key={day} className="border-b border-line/60">
                          <td className="numeric px-3 py-2 font-bold">{day}</td>
                          {matrix.machines.map((machine) => {
                            const cell = matrix.cells.get(matrixKey(day, machine));
                            return <Percent key={machine} value={cell ? cell.oee : null} />;
                          })}
                          <Percent value={dayTotals.get(day)?.oee ?? null} bold />
                        </tr>
                      ))}
                      <tr className="bg-panel-2/60 font-bold">
                        <td className="px-3 py-2">{t('total')}</td>
                        {matrix.machines.map((machine) => (
                          <Percent
                            key={machine}
                            value={perMachine.find((row) => row.machine === machine)?.oee ?? null}
                            bold
                          />
                        ))}
                        <Percent value={range.oee} bold />
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>

              <OeeTrendChart
                rows={byDay}
                timeZone={plant.timezone}
                granularity="day"
                title={t('byDay')}
              />
            </div>
          );
        })()
      )}

      <details className="panel">
        <summary className="cursor-pointer px-4 py-3">
          <span className="eyebrow">{t('currentStandards')}</span>
          <span className="ml-2 text-xs text-muted">{t('currentStandardsHint')}</span>
        </summary>
        <QueryState query={board} skeleton={<Skeleton className="m-3 h-24 w-auto" />}>
          {(data) => (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">{t('machine')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.lastCycle')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.runStandard')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.cavities')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('columns.perPiece')}</th>
                    <th className="hidden px-3 py-2 text-right font-medium md:table-cell">
                      {t('columns.baseStandard')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.machines.map((machine) => {
                    const base = machines.data?.items.find((item) => item.id === machine.id);
                    const run = machine.current_run;
                    return (
                      <tr key={machine.id} className="border-b border-line/60">
                        <td className="px-3 py-2 font-bold">
                          {machine.name}
                          {run ? (
                            <span className="numeric ml-2 text-xs font-medium text-accent-text">
                              {run.product_code} · {run.mold_code}
                            </span>
                          ) : (
                            <span className="ml-2 text-xs text-muted">{t('noRun')}</span>
                          )}
                        </td>
                        <td className="numeric px-3 py-2 text-right">
                          {machine.snapshot.last_cycle_s === null
                            ? EMPTY_VALUE
                            : formatDecimal(machine.snapshot.last_cycle_s, locale)}
                        </td>
                        <td className="numeric px-3 py-2 text-right">
                          {run ? formatDecimal(run.ideal_cycle_s, locale) : EMPTY_VALUE}
                        </td>
                        <td className="numeric px-3 py-2 text-right">
                          {run ? `${run.active_cavities}/${run.nominal_cavities}` : EMPTY_VALUE}
                        </td>
                        <td className="numeric px-3 py-2 text-right font-bold">
                          {run ? formatDecimal(run.ideal_seconds_per_piece, locale) : EMPTY_VALUE}
                        </td>
                        <td className="numeric hidden px-3 py-2 text-right text-muted md:table-cell">
                          {base ? formatDecimal(base.ideal_cycle_s, locale) : EMPTY_VALUE}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </QueryState>
      </details>
    </div>
  );
}
