import { useLocale, useTranslations } from 'next-intl';
import type { OeeMetrics } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { oeeTextClass } from '@/lib/oee-level';

type Size = 'md' | 'lg';

const heroSizes: Record<Size, string> = { md: 'text-2xl', lg: 'text-4xl' };
const partSizes: Record<Size, string> = { md: 'text-lg', lg: 'text-2xl' };

export function OeeMetricsRow({
  metrics,
  size = 'md',
  className,
}: {
  metrics: OeeMetrics;
  size?: Size;
  className?: string;
}) {
  const t = useTranslations('oee');
  const locale = useLocale();
  const parts = [
    {
      key: 'availability',
      short: t('availabilityShort'),
      label: t('availability'),
      value: metrics.availability,
    },
    {
      key: 'performance',
      short: t('performanceShort'),
      label: t('performance'),
      value: metrics.performance,
    },
    { key: 'quality', short: t('qualityShort'), label: t('quality'), value: metrics.quality },
  ];

  return (
    <dl
      className={cn(
        size === 'lg'
          ? 'flex flex-wrap items-end gap-x-6 gap-y-3'
          : 'grid grid-cols-[1.25fr_1fr_1fr_1fr] items-end gap-x-2',
        className,
      )}
    >
      <div
        className={cn(
          'border-line',
          size === 'lg'
            ? 'basis-full border-b pb-2 sm:basis-auto sm:border-r sm:border-b-0 sm:pr-6 sm:pb-0'
            : 'border-r pr-2',
        )}
      >
        <dt className="eyebrow">{t('oee')}</dt>
        <dd
          className={cn(
            'numeric mt-1 leading-none font-medium',
            heroSizes[size],
            oeeTextClass(metrics.oee),
          )}
        >
          {formatPercent(metrics.oee, locale)}
        </dd>
      </div>
      {parts.map((item) => (
        <div key={item.key}>
          <dt className="eyebrow" title={item.label}>
            {item.short}
          </dt>
          <dd className={cn('numeric mt-1 leading-none', partSizes[size])}>
            {formatPercent(item.value, locale)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
