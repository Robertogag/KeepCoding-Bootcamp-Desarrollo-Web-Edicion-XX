'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import type { Granularity, OeeRow } from '@/lib/api/types';
import { formatDate, formatDateTime, formatInteger, formatPercent, formatTime } from '@/lib/format';

interface TrendPoint extends OeeRow {
  ts: number;
  oeePct: number | null;
}

interface OeeTrendChartProps {
  rows: OeeRow[];
  timeZone: string;
  granularity: Granularity;
  title: string;
}

function useBucketLabel(timeZone: string, granularity: Granularity) {
  const locale = useLocale();
  return (ms: number) => {
    if (granularity === 'hour') return formatTime(ms, timeZone, locale);
    if (granularity === 'day') return formatDate(ms, timeZone, locale);
    return formatDateTime(ms, timeZone, locale);
  };
}

type TrendTooltipProps = Partial<TooltipContentProps<number, string>> & {
  labelFor: (ms: number) => string;
};

function TrendTooltip({ active, payload, labelFor }: TrendTooltipProps) {
  const t = useTranslations('oee');
  const tc = useTranslations('chart');
  const locale = useLocale();
  const point = payload?.[0]?.payload as TrendPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border border-line bg-panel px-3 py-2 text-sm shadow-lg">
      <p className="text-muted">{labelFor(point.ts)}</p>
      <p className="text-base font-semibold">
        {formatPercent(point.oee, locale)}{' '}
        <span className="font-normal text-muted">{t('oee')}</span>
      </p>
      <dl className="mt-1 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-muted">{t('availabilityShort')}</dt>
          <dd className="font-medium">{formatPercent(point.availability, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('performanceShort')}</dt>
          <dd className="font-medium">{formatPercent(point.performance, locale)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('qualityShort')}</dt>
          <dd className="font-medium">{formatPercent(point.quality, locale)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-muted">
        {tc('good')} {formatInteger(point.good, locale)} · {tc('reject')}{' '}
        {formatInteger(point.reject, locale)}
      </p>
    </div>
  );
}

export function OeeTrendChart({ rows, timeZone, granularity, title }: OeeTrendChartProps) {
  const t = useTranslations('chart');
  const to = useTranslations('oee');
  const locale = useLocale();
  const labelFor = useBucketLabel(timeZone, granularity);
  const [showTable, setShowTable] = useState(false);

  const data: TrendPoint[] = rows.map((row) => ({
    ...row,
    ts: new Date(row.bucket_start).getTime(),
    oeePct: row.oee === null ? null : Math.round(row.oee * 1000) / 10,
  }));
  const hasData = data.some((point) => point.oee !== null);

  return (
    <figure className="panel p-4">
      <figcaption className="flex items-center justify-between gap-3">
        <span className="eyebrow">{title}</span>
        {hasData ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTable((value) => !value)}
            aria-pressed={showTable}
          >
            {showTable ? t('showChart') : t('showTable')}
          </Button>
        ) : null}
      </figcaption>

      {!hasData ? (
        <p className="mt-6 text-center text-sm text-muted">{t('noData')}</p>
      ) : showTable ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">{t('bucket')}</th>
                <th className="py-2 pr-3 text-right font-medium">{to('oee')}</th>
                <th className="py-2 pr-3 text-right font-medium">{to('availabilityShort')}</th>
                <th className="py-2 pr-3 text-right font-medium">{to('performanceShort')}</th>
                <th className="py-2 pr-3 text-right font-medium">{to('qualityShort')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('good')}</th>
                <th className="py-2 text-right font-medium">{t('reject')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.bucket_start} className="border-b border-line/60">
                  <td className="py-1.5 pr-3">{labelFor(point.ts)}</td>
                  <td className="py-1.5 pr-3 text-right font-medium">
                    {formatPercent(point.oee, locale)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {formatPercent(point.availability, locale)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">
                    {formatPercent(point.performance, locale)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{formatPercent(point.quality, locale)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatInteger(point.good, locale)}</td>
                  <td className="py-1.5 text-right">{formatInteger(point.reject, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 h-64">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 640, height: 256 }}
          >
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--line)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={labelFor}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                axisLine={{ stroke: 'var(--line)' }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(value: number) => `${value}%`}
                width={44}
                tick={{ fill: 'var(--muted)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<TrendTooltip labelFor={labelFor} />}
                cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="oeePct"
                stroke="var(--series-1)"
                strokeWidth={2}
                strokeLinecap="round"
                dot={{ r: 4, fill: 'var(--series-1)', stroke: 'var(--panel)', strokeWidth: 2 }}
                activeDot={{
                  r: 6,
                  fill: 'var(--series-1)',
                  stroke: 'var(--panel)',
                  strokeWidth: 2,
                }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
