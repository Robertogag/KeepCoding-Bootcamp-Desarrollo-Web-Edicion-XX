import { useLocale, useTranslations } from 'next-intl';
import type { OeeMetrics } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { oeeLevel } from '@/lib/oee-level';

const levelBar = { good: 'bg-running', warn: 'bg-idle', bad: 'bg-down' } as const;

// A, P y Q como barras de progreso con el mismo semáforo que el OEE.
export function MetricBars({ metrics, className }: { metrics: OeeMetrics; className?: string }) {
  const t = useTranslations('oee');
  const locale = useLocale();
  const items = [
    { key: 'A', label: t('availability'), value: metrics.availability },
    { key: 'P', label: t('performance'), value: metrics.performance },
    { key: 'Q', label: t('quality'), value: metrics.quality },
  ];
  return (
    <dl className={cn('space-y-1.5', className)}>
      {items.map((item) => {
        const level = oeeLevel(item.value);
        const width = item.value === null ? 0 : Math.max(0, Math.min(1, item.value)) * 100;
        return (
          <div key={item.key} className="grid grid-cols-[1.25rem_1fr_3.5rem] items-center gap-2">
            <dt className="eyebrow" title={item.label}>
              {item.key}
            </dt>
            <dd className="h-1.5 overflow-hidden rounded-full bg-line-strong/40">
              <span
                className={cn('block h-full rounded-full', level ? levelBar[level] : 'bg-offline')}
                style={{ width: `${width}%` }}
              />
            </dd>
            <dd className="numeric text-right text-xs font-bold">
              {formatPercent(item.value, locale)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
