'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MetricBars } from '@/components/oee/MetricBars';
import { OeeGauge } from '@/components/oee/OeeGauge';
import { Clock } from '@/components/status/Clock';
import { StateIndicator } from '@/components/status/StateIndicator';
import { Button } from '@/components/ui/Button';
import { IconAlert } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import type { BoardMachine, BoardStop, PlantBoardData } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import {
  EMPTY_VALUE,
  formatDuration,
  formatInteger,
  formatPercent,
  formatSince,
} from '@/lib/format';
import { MACHINE_STATES, stateStyles } from '@/lib/machine-state';
import { oeeTextClass } from '@/lib/oee-level';
import { MachineImage } from './MachineImage';

interface PlantLayoutViewProps {
  board: PlantBoardData;
  plantId: number;
  now: number;
  toolbar?: ReactNode;
}

function stopElapsed(stop: BoardStop, now: number): string {
  if (stop.started_at) return formatDuration((now - new Date(stop.started_at).getTime()) / 1000);
  if (stop.elapsed_s !== null) return formatDuration(stop.elapsed_s);
  return EMPTY_VALUE;
}

function StopsTicker({ board, now }: { board: PlantBoardData; now: number }) {
  const t = useTranslations('layout');
  const td = useTranslations('downtimes');
  const tm = useTranslations('machine');
  const ts = useTranslations('machineState');
  const locale = useLocale();
  const lineName = (id: number | null) => board.lines.find((line) => line.id === id)?.name ?? '';
  const machineOf = (id: number | null) => board.machines.find((machine) => machine.id === id);
  return (
    <section aria-label={t('activeStops')} className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="eyebrow text-accent-text">{t('activeStops')}</span>
        <span className="numeric text-xs font-bold text-muted">
          {formatInteger(board.stops.length, locale)}
        </span>
      </div>
      {board.stops.length === 0 ? (
        <p className="px-3 py-2 text-sm font-semibold text-running">{t('noStops')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {board.stops.map((stop) => {
            const line = stop.kind === 'line';
            const machine = line ? undefined : machineOf(stop.machine_id);
            const alarm = machine?.snapshot.alarm_code ?? 0;
            const detail = line
              ? ((locale === 'en' ? stop.label_en : stop.label_es) ??
                stop.reason_code ??
                EMPTY_VALUE)
              : alarm > 0
                ? tm('alarm', { code: alarm })
                : null;
            return (
              <li
                key={`${stop.kind}-${stop.id ?? stop.machine_id}`}
                className={cn(
                  'fade-in flex items-center gap-3 px-3 py-1.5 text-sm',
                  line ? 'bg-idle-soft' : 'bg-down-soft',
                )}
              >
                <span className={cn('chip', line ? 'text-idle' : 'text-down')}>
                  <IconAlert className="size-3.5" />
                  {line ? td('lineStopped') : ts('DOWN')}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {line ? lineName(stop.line_id) : (machine?.name ?? '')}
                  {detail ? <span className="font-medium text-muted"> · {detail}</span> : null}
                  {stop.planned !== null ? (
                    <span className="text-muted">
                      {' '}
                      · {stop.planned ? td('planned') : td('unplanned')}
                    </span>
                  ) : null}
                  {stop.comment ? <span className="text-muted"> · {stop.comment}</span> : null}
                </span>
                <span className="numeric shrink-0 font-extrabold" suppressHydrationWarning>
                  {stopElapsed(stop, now)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Máquina en el plano: imagen girada 90° con el filtro de estado, código sobre la máquina y datos de la corrida.
function MachineBay({
  machine,
  plantId,
  now,
}: {
  machine: BoardMachine;
  plantId: number;
  now: number;
}) {
  const t = useTranslations('layout');
  const tc = useTranslations('context');
  const ts = useTranslations('machineState');
  const tm = useTranslations('machine');
  const locale = useLocale();
  const { snapshot } = machine;
  const styles = stateStyles[snapshot.state];
  const run = machine.current_run;
  const model = [machine.brand, machine.model].filter(Boolean).join(' ');
  const since = formatSince(snapshot.since, now);
  const summary = [
    machine.name + ' · ' + ts(snapshot.state) + ' · ' + since,
    'OEE ' + formatPercent(snapshot.oee_today.oee, locale),
    run
      ? tc('product') +
        ': ' +
        run.product_code +
        ' ' +
        run.product_name +
        ' · ' +
        tc('mold') +
        ': ' +
        run.mold_code +
        ' · ' +
        tc('cavities') +
        ': ' +
        run.active_cavities +
        '/' +
        run.nominal_cavities
      : t('noRun'),
  ].join('\n');
  // Ficha de instrumento: barra de estado, silueta teñida pequeña, nombre legible, OEE grande y A/P/Q.
  return (
    <Link
      href={'/app/plants/' + plantId + '/machines/' + machine.id}
      title={summary}
      className={cn(
        'fade-in group flex w-full max-w-[24rem] flex-col overflow-hidden rounded-lg border border-line bg-panel-2/70 transition-colors hover:border-line-strong hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-accent-text',
        styles.glow,
        !machine.is_active && 'opacity-60',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.08em] uppercase',
          styles.soft,
          styles.text,
        )}
      >
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="led" />
          {ts(snapshot.state)}
        </span>
        <span className="numeric normal-case" suppressHydrationWarning>
          {since}
        </span>
      </div>
      <div className="flex items-center gap-3 px-3 pt-2.5">
        <span className="block w-24 shrink-0">
          <MachineImage state={snapshot.state} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">{machine.name}</p>
          <p className="truncate text-[11px] text-muted">{model || EMPTY_VALUE}</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 px-3 pt-2 pb-1">
        <p
          className={cn(
            'numeric text-[30px] leading-none font-black',
            oeeTextClass(snapshot.oee_today.oee),
          )}
        >
          {formatPercent(snapshot.oee_today.oee, locale)}
        </p>
        <p className="numeric min-w-0 truncate text-right text-[11px] font-bold text-accent-text">
          {run
            ? run.product_code +
              ' · ' +
              run.mold_code +
              ' · ' +
              run.active_cavities +
              '/' +
              run.nominal_cavities
            : t('noRun')}
        </p>
      </div>
      <MetricBars metrics={snapshot.oee_today} className="px-3 pb-3" />
      {snapshot.state === 'DOWN' && snapshot.alarm_code > 0 ? (
        <p className="px-3 pb-2 text-[10px] font-bold text-down">
          {tm('alarm', { code: snapshot.alarm_code })}
        </p>
      ) : null}
    </Link>
  );
}

// Centro de información del plano: escuela, banderas, reloj y resumen de la planta.
function InfoCenter({ board }: { board: PlantBoardData }) {
  const t = useTranslations('layout');
  const tp = useTranslations('publicPlant');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [logoMissing, setLogoMissing] = useState(false);
  return (
    <div
      aria-label={t('infoCenter')}
      className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 border-t border-dashed border-line-strong px-2 pt-4"
    >
      <img
        src="/flags/spain.svg"
        alt={t('flagSpain')}
        className="h-8 w-12 rounded-sm border border-line-strong object-cover"
      />
      {logoMissing ? (
        <span className="text-xl font-black tracking-[0.04em] text-muted">KEEPCODING</span>
      ) : (
        <img
          src="/branding/keepcoding.svg"
          alt={t('school')}
          className="h-8 w-auto max-w-44 object-contain"
          onError={() => setLogoMissing(true)}
        />
      )}
      <span className="eyebrow hidden md:inline">{t('project')}</span>
      <Clock
        timeZone={board.plant.timezone}
        className="numeric text-2xl leading-none font-black tracking-[0.04em]"
      />
      <span className="chip text-accent-text">
        {t('planning')} {formatInteger(board.summary.active_runs, locale)}/
        {formatInteger(board.summary.active_machine_count, locale)}
      </span>
      <span className={cn('chip', board.scheduled_now ? 'text-running' : 'text-muted')}>
        {board.scheduled_now ? tp('liveBoard') : tc('noData')}
      </span>
      <img
        src="/flags/mexico.png"
        alt={t('flagMexico')}
        className="h-8 w-12 rounded-sm border border-line-strong object-cover"
      />
    </div>
  );
}

export function PlantLayoutView({ board, plantId, now, toolbar }: PlantLayoutViewProps) {
  const t = useTranslations('layout');
  const tc = useTranslations('common');
  const ts = useTranslations('machineState');
  const tp = useTranslations('publicPlant');
  const td = useTranslations('downtimes');
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  }

  const stoppedLines = new Set(
    board.stops.filter((stop) => stop.kind === 'line').map((stop) => stop.line_id),
  );
  const saved = board.machines.filter((machine) => machine.position !== null);
  const groups = [
    ...board.lines.map((line) => ({
      key: `line-${line.id}`,
      code: line.code,
      name: line.name,
      stopped: stoppedLines.has(line.id),
      machines: board.machines.filter((machine) => machine.line_id === line.id),
    })),
    {
      key: 'none',
      code: '',
      name: t('noLine'),
      stopped: false,
      machines: board.machines.filter(
        (machine) =>
          machine.line_id === null || !board.lines.some((line) => line.id === machine.line_id),
      ),
    },
  ].filter((group) => group.machines.length > 0);
  const running = board.summary.states.RUNNING;

  const row = (group: (typeof groups)[number]) => (
    <div key={group.key}>
      <header className="mb-2 flex flex-wrap items-center gap-3">
        {group.code ? <span className="chip text-accent-text">{group.code}</span> : null}
        <h3 className="text-[13px] font-extrabold tracking-[0.08em] uppercase">{group.name}</h3>
        <span className="text-xs font-bold text-muted">
          {tc('machines', { count: group.machines.length })}
        </span>
        {group.stopped ? <span className="chip text-idle">{td('lineStopped')}</span> : null}
      </header>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(12.5rem,1fr))]">
        {group.machines.map((machine) => (
          <MachineBay key={machine.id} machine={machine} plantId={plantId} now={now} />
        ))}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn('space-y-4', fullscreen && 'overflow-auto bg-bg p-6')}>
      <section className="panel flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {MACHINE_STATES.map((state) => (
            <span
              key={state}
              className={cn(
                'flex items-center gap-2 text-base font-extrabold',
                stateStyles[state].text,
              )}
            >
              <span aria-hidden="true" className="led" />
              <span className="numeric text-lg">{board.summary.states[state]}</span>
              <span className="text-sm">{ts(state)}</span>
            </span>
          ))}
          <span className="text-sm font-bold text-muted">
            = {tc('machines', { count: board.summary.machine_count })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <OeeGauge value={board.summary.oee_today.oee} size={64} stroke={7} />
            <div className="hidden w-40 lg:block">
              <p className="eyebrow">{tp('plantOee')}</p>
              <MetricBars metrics={board.summary.oee_today} className="mt-1" />
            </div>
          </div>
          {toolbar}
          <Button variant="secondary" size="sm" onClick={toggleFullscreen}>
            {fullscreen ? t('exitFullscreen') : t('fullscreen')}
          </Button>
        </div>
      </section>

      {board.stops.length > 0 ? <StopsTicker board={board} now={now} /> : null}

      {saved.length > 0 ? (
        <section className="panel relative aspect-[16/9] w-full overflow-hidden">
          {board.machines.map((machine) =>
            machine.position ? (
              <div
                key={machine.id}
                className="absolute"
                style={{
                  left: `${machine.position.x * 100}%`,
                  top: `${machine.position.y * 100}%`,
                  width: `${machine.position.width * 100}%`,
                  height: `${machine.position.height * 100}%`,
                  transform: `rotate(${machine.position.rotation}deg)`,
                }}
              >
                <MachineBay machine={machine} plantId={plantId} now={now} />
              </div>
            ) : null,
          )}
        </section>
      ) : (
        <section className="panel space-y-3 px-3 py-4 sm:px-5">
          {groups.map((group, index) => (
            <div
              key={group.key}
              className={cn(index > 0 && 'border-t border-dashed border-line-strong pt-4')}
            >
              {row(group)}
            </div>
          ))}
          <InfoCenter board={board} />
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted">
        <ul aria-label={t('legend')} className="flex flex-wrap gap-4">
          {MACHINE_STATES.map((state) => (
            <li key={state}>
              <StateIndicator state={state} size="sm" />
            </li>
          ))}
        </ul>
        <span className="numeric">
          {t('summary', { total: board.summary.machine_count, running })}
        </span>
      </footer>
    </div>
  );
}
