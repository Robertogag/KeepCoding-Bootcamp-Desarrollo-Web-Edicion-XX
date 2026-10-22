'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import type { SeriesPoint, TelemetrySeries } from '@/lib/api/types';
import { EMPTY_VALUE, formatDateTime, formatInteger, formatTime, intlLocale } from '@/lib/format';

interface ChartPoint {
  ts: number;
  avg: number | null;
  band: [number, number] | null;
  point: SeriesPoint;
}

export function formatReading(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(value);
}

type SeriesTooltipProps = Partial<TooltipContentProps<number, string>> & {
  unit: string;
  timeZone: string;
  spanMs: number;
};

function SeriesTooltip({ active, payload, unit, timeZone, spanMs }: SeriesTooltipProps) {
  const t = useTranslations('telemetry');
  const locale = useLocale();
  const entry = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !entry) return null;
  const { point } = entry;
  const stamp =
    spanMs > 36 * 3_600_000
      ? formatDateTime(entry.ts, timeZone, locale)
      : formatTime(entry.ts, timeZone, locale);
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm shadow-lg">
      <p className="numeric text-muted">{stamp}</p>
      <p className="numeric text-base font-semibold">
        {formatReading(point.avg, locale)}{' '}
        <span className="text-xs font-normal text-muted">{unit}</span>
      </p>
      <p className="numeric text-xs text-muted">
        {formatReading(point.min, locale)} – {formatReading(point.max, locale)} ·{' '}
        {t('points', { count: point.counts.good })}
      </p>
      {point.counts.bad + point.counts.stale + point.counts.unavailable + point.counts.missing >
      0 ? (
        <p className="text-xs text-idle">
          {t('quality.bad')} {formatInteger(point.counts.bad, locale)} · {t('quality.stale')}{' '}
          {formatInteger(point.counts.stale, locale)} · {t('quality.unavailable')}{' '}
          {formatInteger(point.counts.unavailable + point.counts.missing, locale)}
        </p>
      ) : null}
    </div>
  );
}

interface SeriesChartProps {
  series: TelemetrySeries;
  label: string;
  timeZone: string;
  from: number;
  to: number;
  height?: number;
}

// Promedio por intervalo como línea limpia (mínimo y máximo van en el tooltip); los huecos no se unen.
export function SeriesChart({ series, label, timeZone, from, to, height = 180 }: SeriesChartProps) {
  const t = useTranslations('telemetry');
  const locale = useLocale();
  const unit = series.unit ?? '';
  const data: ChartPoint[] = series.points.map((point) => ({
    ts: new Date(point.bucket_start).getTime(),
    avg: point.avg,
    band: point.min !== null && point.max !== null ? [point.min, point.max] : null,
    point,
  }));
  const hasData = data.some((item) => item.avg !== null);
  const counts = series.points.reduce(
    (acc, point) => ({
      good: acc.good + point.counts.good,
      other:
        acc.other +
        point.counts.bad +
        point.counts.stale +
        point.counts.unavailable +
        point.counts.missing,
    }),
    { good: 0, other: 0 },
  );
  const spanMs = to - from;
  const tick = (ms: number) =>
    spanMs > 36 * 3_600_000
      ? formatDateTime(ms, timeZone, locale)
      : formatTime(ms, timeZone, locale);

  return (
    <figure className="panel p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">
          {label}
          {unit ? <span className="numeric ml-2 text-xs text-muted">{unit}</span> : null}
        </span>
        <span className="numeric text-xs text-muted">
          {t('points', { count: counts.good })}
          {counts.other > 0
            ? ` · ${t('quality.unavailable')} ${formatInteger(counts.other, locale)}`
            : ''}
        </span>
      </figcaption>
      {!hasData ? (
        <p className="mt-6 text-center text-sm text-muted">{t('noSamples')}</p>
      ) : (
        <div className="mt-2" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                domain={[from, to]}
                tickFormatter={tick}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                width={52}
                domain={['auto', 'auto']}
                tickFormatter={(value: number) => formatReading(value, locale)}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<SeriesTooltip unit={unit} timeZone={timeZone} spanMs={spanMs} />}
                cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--series-1)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: 'var(--series-1)',
                  stroke: 'var(--panel)',
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
