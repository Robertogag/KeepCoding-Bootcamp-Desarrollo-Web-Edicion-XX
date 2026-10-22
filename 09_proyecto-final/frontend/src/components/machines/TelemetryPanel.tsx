'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatReading, SeriesChart } from '@/components/charts/SeriesChart';
import { Select } from '@/components/form/Field';
import { ErrorState } from '@/components/state/ErrorState';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { buttonClasses } from '@/components/ui/Button';
import { useNow } from '@/hooks/useNow';
import { Link } from '@/i18n/navigation';
import { getTelemetrySeries, listAllVariables, listTelemetry } from '@/lib/api/injection';
import type { MachineVariable, TelemetryQuality, TelemetrySample } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE, formatInteger, formatTime } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

const MINUTE = 60_000;
const LIVE_WINDOW = 15 * MINUTE;
// Canales base del protocolo: existen sin configurar variables y van en s/disparo.
export const BASE_CHANNELS = ['cycle_time_s', 'ideal_cycle_s'] as const;

const qualityClass: Record<TelemetryQuality, string> = {
  good: 'text-muted',
  stale: 'text-idle',
  bad: 'text-down',
  unavailable: 'text-down',
};

export function latestSample(items: TelemetrySample[]): TelemetrySample | null {
  let latest: TelemetrySample | null = null;
  for (const item of items) {
    if (!latest || item.sampled_at > latest.sampled_at) latest = item;
  }
  return latest;
}

export function TelemetryPanel({
  machineId,
  plantId,
  timeZone,
}: {
  machineId: number;
  plantId: number;
  timeZone: string;
}) {
  const t = useTranslations('telemetry');
  const locale = useLocale();
  const describe = useErrorMessage();
  const now = useNow(MINUTE);
  const nowMinute = Math.floor(now / MINUTE) * MINUTE;
  const [selected, setSelected] = useState<string>('cycle_time_s');
  const variables = useQuery({
    queryKey: queryKeys.machines.variables(machineId),
    queryFn: () => listAllVariables(machineId),
    staleTime: 60_000,
  });
  const active = (variables.data ?? [])
    .filter((item) => item.is_active)
    .sort((a, b) => a.address - b.address);
  const options = [
    ...BASE_CHANNELS.map((code) => ({ code, label: t(`base.${code}`) })),
    ...active.map((item) => ({ code: item.code, label: item.name || item.code })),
  ];
  const code = options.some((item) => item.code === selected) ? selected : 'cycle_time_s';
  const codeLabel = options.find((item) => item.code === code)?.label ?? code;

  // Última lectura: ventana corta cerrada al instante actual, renovada cada 10 s.
  const latest = useQuery({
    queryKey: ['machines', machineId, 'telemetry', 'latest'],
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - 2 * MINUTE);
      return listTelemetry(machineId, {
        from: from.toISOString(),
        to: to.toISOString(),
        page_size: 100,
      });
    },
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
  });
  const from = nowMinute - LIVE_WINDOW;
  const series = useQuery({
    queryKey: [
      ...queryKeys.machines.telemetry(machineId, {
        from: new Date(from).toISOString(),
        to: new Date(nowMinute).toISOString(),
      }),
      'series',
      code,
    ],
    queryFn: () =>
      getTelemetrySeries(machineId, {
        from: new Date(from).toISOString(),
        to: new Date(nowMinute).toISOString(),
        codes: [code],
        max_points: 90,
      }),
    refetchInterval: 15_000,
    // Solo se conserva la serie anterior si es de la misma variable: nunca se pinta otra bajo este rótulo.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey.at(-1) === code ? previous : undefined,
  });

  const sample = latest.data ? latestSample(latest.data.items) : null;
  const shots = sample?.values.shot_count;
  const variableLabel = (variable: MachineVariable) => variable.name || variable.code;

  return (
    <section aria-labelledby="machine-telemetry" className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="machine-telemetry" className="eyebrow">
          {t('title')}
        </h3>
        <div className="flex gap-1">
          <Link
            href={`/app/plants/${plantId}/machines/${machineId}/history`}
            className={buttonClasses('ghost', 'sm')}
          >
            {t('history')}
          </Link>
          <Link
            href={`/app/plants/${plantId}/machines/${machineId}/variables`}
            className={buttonClasses('ghost', 'sm')}
          >
            {t('configure')}
          </Link>
        </div>
      </div>

      <QueryState query={variables} skeleton={<Skeleton className="mt-3 h-32 w-full" />}>
        {() => (
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="numeric text-xs text-muted" suppressHydrationWarning>
                {sample
                  ? `${t('sampledAt', { time: formatTime(sample.sampled_at, timeZone, locale) })} · ${t('source')} ${sample.source} · ${sample.run_id ? t('run', { id: sample.run_id }) : t('noRun')}`
                  : t('noSamples')}
              </p>
              {shots ? (
                <div className="mt-3 flex items-baseline gap-3 rounded-md border border-line bg-panel-2 px-3 py-2">
                  <span className="eyebrow">{t('shots')}</span>
                  <span
                    className={cn(
                      'numeric text-2xl font-extrabold',
                      shots.quality === 'stale' && 'text-idle',
                    )}
                  >
                    {shots.value === null ? EMPTY_VALUE : formatInteger(shots.value, locale)}
                  </span>
                  <span className="text-xs text-muted">{t('shotsHint')}</span>
                </div>
              ) : null}
              {active.length === 0 ? (
                <div className="mt-3">
                  <p className="font-bold">{t('noVariables')}</p>
                  <p className="mt-1 text-sm text-muted">{t('noVariablesText')}</p>
                </div>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-1.5 pr-2 font-medium">{t('columns.variable')}</th>
                      <th className="py-1.5 pr-2 text-right font-medium">{t('columns.value')}</th>
                      <th className="py-1.5 pr-2 font-medium">{t('columns.unit')}</th>
                      <th className="py-1.5 font-medium">{t('columns.quality')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((variable) => {
                      const reading = sample?.values[variable.code];
                      const quality: TelemetryQuality = reading?.quality ?? 'unavailable';
                      return (
                        <tr key={variable.id} className="border-b border-line/60">
                          <td className="py-1.5 pr-2">
                            <button
                              type="button"
                              onClick={() => setSelected(variable.code)}
                              aria-pressed={variable.code === code}
                              className={cn(
                                'text-left hover:underline',
                                variable.code === code && 'font-bold text-accent-text',
                              )}
                            >
                              {variableLabel(variable)}
                            </button>
                          </td>
                          <td
                            className={cn(
                              'numeric py-1.5 pr-2 text-right font-bold',
                              quality === 'stale' && 'text-idle',
                            )}
                          >
                            {reading && reading.value !== null
                              ? formatReading(reading.value, locale)
                              : EMPTY_VALUE}
                          </td>
                          <td className="numeric py-1.5 pr-2 text-xs text-muted">
                            {reading?.unit || variable.unit || EMPTY_VALUE}
                          </td>
                          <td className={cn('py-1.5 text-xs', qualityClass[quality])}>
                            {t(`quality.${quality}`)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="min-w-0">
              <label className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {t('chart')}
                <Select
                  value={code}
                  onChange={(event) => setSelected(event.target.value)}
                  className="h-9 w-auto"
                >
                  {options.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </Select>
                <span className="numeric text-xs">{t('ranges.m15')}</span>
              </label>
              <div className={cn('mt-2 space-y-3', series.isPlaceholderData && 'opacity-60')}>
                {series.isPending ? (
                  <Skeleton className="h-44 w-full" />
                ) : series.isError ? (
                  <ErrorState
                    message={describe(series.error)}
                    onRetry={() => void series.refetch()}
                  />
                ) : (
                  series.data.series.map((item, index) => (
                    <SeriesChart
                      key={`${item.code}-${item.mapping_key ?? index}`}
                      series={item}
                      label={
                        series.data.series.length > 1
                          ? `${codeLabel} · ${t('variant', { key: item.mapping_key ?? index + 1 })}`
                          : codeLabel
                      }
                      timeZone={timeZone}
                      from={from}
                      to={nowMinute}
                      height={160}
                    />
                  ))
                )}
              </div>
              <p className="mt-2 text-xs text-muted">{t('gaps')}</p>
            </div>
          </div>
        )}
      </QueryState>
    </section>
  );
}
