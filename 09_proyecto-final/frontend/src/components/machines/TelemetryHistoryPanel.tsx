'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { SeriesChart } from '@/components/charts/SeriesChart';
import { Input, Select } from '@/components/form/Field';
import { usePlant } from '@/components/plants/PlantContext';
import { ErrorState } from '@/components/state/ErrorState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { getTelemetrySeries, listAllVariables, listRuns } from '@/lib/api/injection';
import { getMachine } from '@/lib/api/machines';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import { BASE_CHANNELS } from './TelemetryPanel';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const PRESETS = { h1: HOUR, h8: 8 * HOUR, h24: DAY, d7: 7 * DAY } as const;
type Preset = keyof typeof PRESETS;
const MAX_RANGE = 31 * DAY;
const MAX_CODES = 6;
// Las referencias del proceso de inyección van primero: ciclo, llenado, dosificación, cojín, V/P y presión.
const PREFERRED = [
  'cycle_time_s',
  'filling_time_s',
  'dose_time_s',
  'min_cushion_position',
  'vp_switchover_position',
  'peak_injection_pressure',
];

interface Channel {
  code: string;
  label: string;
  unit: string;
  base: boolean;
  active: boolean;
}

function toLocalInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultCodes(channels: Channel[]): string[] {
  const codes = channels.map((item) => item.code);
  const preferred = PREFERRED.filter((code) => codes.includes(code));
  const rest = codes.filter((code) => !preferred.includes(code));
  return [...preferred, ...rest].slice(0, 2);
}

export function TelemetryHistoryPanel({ machineId }: { machineId: number }) {
  const { plant } = usePlant();
  const t = useTranslations('history');
  const tt = useTranslations('telemetry');
  const locale = useLocale();
  const describe = useErrorMessage();
  // Ancla fija del rango: cambia al elegir un preset, no con el reloj, para no repetir la consulta.
  const [nowMinute, setAnchor] = useState(() => Math.floor(Date.now() / MINUTE) * MINUTE);
  const [preset, setPreset] = useState<Preset | 'custom'>('h1');
  const [customFrom, setCustomFrom] = useState(() => toLocalInput(Date.now() - 8 * HOUR));
  const [customTo, setCustomTo] = useState(() => toLocalInput(Date.now()));
  const [applied, setApplied] = useState<[number, number] | null>(null);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [runId, setRunId] = useState('');

  const machine = useQuery({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => getMachine(machineId),
  });
  const variables = useQuery({
    queryKey: queryKeys.machines.variables(machineId),
    queryFn: () => listAllVariables(machineId),
    staleTime: 60_000,
  });
  const channels: Channel[] = [
    ...BASE_CHANNELS.map((code) => ({
      code,
      label: tt(`base.${code}`),
      unit: '',
      base: true,
      active: true,
    })),
    ...[...(variables.data ?? [])]
      .sort((a, b) => a.address - b.address)
      .map((item) => ({
        code: item.code,
        label: item.name || item.code,
        unit: item.unit,
        base: false,
        active: item.is_active,
      })),
  ];
  const codes = chosen ?? defaultCodes(channels);

  const [from, to] =
    preset === 'custom'
      ? (applied ?? [nowMinute - 8 * HOUR, nowMinute])
      : [nowMinute - PRESETS[preset], nowMinute];
  const validRange = from < to && to - from <= MAX_RANGE;
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();
  const runFilters = { machine_id: machineId, from: fromIso, to: toIso, page_size: 50 };

  const runs = useQuery({
    queryKey: queryKeys.injection.runs(plant.id, runFilters),
    queryFn: () => listRuns(plant.id, runFilters),
    enabled: validRange,
  });
  const run = runId ? Number(runId) : undefined;
  const series = useQuery({
    queryKey: [
      ...queryKeys.machines.telemetry(machineId, { from: fromIso, to: toIso }),
      'series',
      codes,
      run ?? null,
    ],
    queryFn: () =>
      getTelemetrySeries(machineId, {
        from: fromIso,
        to: toIso,
        codes,
        max_points: 300,
        run_id: run,
      }),
    // Espera a la lista de variables: así la selección por omisión no cambia y la consulta no se repite.
    enabled: validRange && codes.length > 0 && variables.isSuccess,
    placeholderData: keepPreviousData,
    // Sin refresco automático: la consulta de 8 h es pesada en el servidor y el detalle ya es en vivo.
    refetchInterval: false,
  });

  function toggle(code: string) {
    const next = codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code];
    if (next.length === 0 || next.length > MAX_CODES) return;
    setChosen(next);
  }

  function applyCustom() {
    const start = new Date(customFrom).getTime();
    const end = new Date(customTo).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return;
    setPreset('custom');
    setApplied([Math.floor(start / MINUTE) * MINUTE, Math.floor(end / MINUTE) * MINUTE]);
  }

  const label = (code: string) => channels.find((item) => item.code === code)?.label ?? code;

  return (
    <div className="space-y-4">
      <nav>
        <Link
          href={`/app/plants/${plant.id}/machines/${machineId}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <IconChevronLeft className="size-4" />
          {machine.data?.name ?? ''}
        </Link>
      </nav>
      <div>
        <p className="eyebrow text-accent-text">{t('link')}</p>
        <h2 className="text-2xl font-extrabold tracking-tight">
          {t('title', { machine: machine.data?.name ?? '' })}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">{t('subtitle')}</p>
      </div>

      <div className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div
            role="group"
            aria-label={tt('range')}
            className="flex rounded-md border border-line-strong p-0.5"
          >
            {(Object.keys(PRESETS) as Preset[]).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={preset === item}
                onClick={() => {
                  setPreset(item);
                  setAnchor(Math.floor(Date.now() / MINUTE) * MINUTE);
                }}
                className={cn(
                  'numeric rounded px-3 py-1 text-sm font-bold',
                  preset === item ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg',
                )}
              >
                {item === 'd7' ? '7 d' : tt(`ranges.${item}`)}
              </button>
            ))}
          </div>
          <label className="text-sm text-muted">
            {t('from')}
            <Input
              type="datetime-local"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="mt-1 w-auto"
            />
          </label>
          <label className="text-sm text-muted">
            {t('to')}
            <Input
              type="datetime-local"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="mt-1 w-auto"
            />
          </label>
          <Button variant="secondary" size="md" onClick={applyCustom}>
            {t('apply')}
          </Button>
          <label className="text-sm text-muted">
            {t('runs')}
            <Select
              value={runId}
              onChange={(event) => setRunId(event.target.value)}
              className="mt-1 w-auto"
            >
              <option value="">—</option>
              {(runs.data?.items ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.id} · {item.context.product_code} ·{' '}
                  {formatDateTime(item.started_at, plant.timezone, locale)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="text-xs text-muted">{t('zoneHint', { zone: plant.timezone })}</p>
        {!validRange ? (
          <p role="alert" className="text-sm text-down">
            {t('invalidRange')}
          </p>
        ) : null}
        <QueryState query={variables} skeleton={<Skeleton className="h-8 w-full" />}>
          {() => (
            <div className="flex flex-wrap gap-2" role="group" aria-label={tt('variable')}>
              {channels.map((channel) => (
                <button
                  key={channel.code}
                  type="button"
                  aria-pressed={codes.includes(channel.code)}
                  onClick={() => toggle(channel.code)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-bold',
                    codes.includes(channel.code)
                      ? 'border-accent-text bg-panel-2 text-accent-text'
                      : 'border-line-strong text-muted hover:text-fg',
                    !channel.active && 'opacity-60',
                  )}
                >
                  {channel.label}
                  {channel.base ? (
                    <span className="ml-1 text-[10px] font-medium tracking-[0.06em] text-muted uppercase">
                      {tt('baseChannel')}
                    </span>
                  ) : channel.unit ? (
                    <span className="numeric ml-1 text-muted">{channel.unit}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </QueryState>
        <p className="text-xs text-muted">{tt('gaps')}</p>
      </div>

      {!validRange ? null : series.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : series.isError ? (
        <ErrorState message={describe(series.error)} onRetry={() => void series.refetch()} />
      ) : (
        <div className={cn('grid gap-4 xl:grid-cols-2', series.isPlaceholderData && 'opacity-60')}>
          {series.data.series.map((item, index) => {
            const variants = series.data.series.filter((entry) => entry.code === item.code).length;
            return (
              <SeriesChart
                key={`${item.code}-${item.mapping_key ?? index}`}
                series={item}
                label={
                  variants > 1
                    ? `${label(item.code)} · ${tt('variant', { key: item.mapping_key ?? index + 1 })}`
                    : label(item.code)
                }
                timeZone={plant.timezone}
                from={from}
                to={to}
                height={200}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
