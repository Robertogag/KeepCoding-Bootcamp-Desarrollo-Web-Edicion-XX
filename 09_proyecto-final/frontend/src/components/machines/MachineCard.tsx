import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { MetricBars } from '@/components/oee/MetricBars';
import { OeeGauge } from '@/components/oee/OeeGauge';
import { StateIndicator } from '@/components/status/StateIndicator';
import { Link } from '@/i18n/navigation';
import type { BoardRun, PublicMachine } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { mediaUrl } from '@/lib/env';
import { EMPTY_VALUE, formatInteger, formatSince } from '@/lib/format';
import { stateStyles } from '@/lib/machine-state';

interface MachineCardProps {
  machine: PublicMachine;
  href: string;
  now: number;
  run?: BoardRun | null;
  footer?: ReactNode;
}

// Tarjeta de máquina: estado, identidad, OEE en anillo, A/P/Q y contadores. Solo lleva imagen
// cuando la máquina tiene foto propia.
export function MachineCard({ machine, href, now, run, footer }: MachineCardProps) {
  const t = useTranslations('machine');
  const tl = useTranslations('layout');
  const locale = useLocale();
  const { snapshot } = machine;
  const styles = stateStyles[snapshot.state];
  const model = [machine.brand, machine.model].filter(Boolean).join(' ');

  return (
    <article className={cn('panel fade-in flex flex-col overflow-hidden', styles.glow)}>
      <div className={cn('flex items-center justify-between gap-3 px-4 py-2', styles.soft)}>
        <StateIndicator state={snapshot.state} variant="label" className={styles.text} />
        <p className="numeric text-xs text-muted">
          {t('sinceShort')}{' '}
          <span className="font-bold text-fg" suppressHydrationWarning>
            {formatSince(snapshot.since, now)}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-4 p-4">
        {machine.photo ? (
          <img
            src={mediaUrl(machine.photo.sm)}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'h-16 w-24 shrink-0 rounded-md border border-line object-cover',
              snapshot.state === 'OFFLINE' && 'opacity-50 grayscale',
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl leading-tight font-extrabold tracking-tight">
            <Link href={href} className="hover:text-accent-text">
              {machine.name}
            </Link>
          </h3>
          <p className="mt-1 truncate text-xs text-muted">{model || EMPTY_VALUE}</p>
          {run !== undefined ? (
            <p className="numeric mt-2 truncate text-xs">
              {run ? (
                <>
                  <span className="font-bold text-accent-text">{run.product_code}</span>
                  <span className="text-muted"> · {run.mold_code}</span>
                  <span className="text-muted">
                    {' '}
                    · {run.active_cavities}/{run.nominal_cavities}
                  </span>
                </>
              ) : (
                <span className="text-muted">{tl('noRun')}</span>
              )}
            </p>
          ) : null}
        </div>
        <OeeGauge value={snapshot.oee_today.oee} size={92} stroke={9} label="OEE" />
      </div>
      <MetricBars metrics={snapshot.oee_today} className="px-4 pb-4" />
      <dl className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
        <div className="flex items-baseline gap-1.5">
          <dt>{t('good')}</dt>
          <dd className="numeric text-sm font-bold text-fg">
            {formatInteger(snapshot.good, locale)}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt>{t('reject')}</dt>
          <dd
            className={cn(
              'numeric text-sm font-bold',
              snapshot.reject > 0 ? 'text-down' : 'text-fg',
            )}
          >
            {formatInteger(snapshot.reject, locale)}
          </dd>
        </div>
        {snapshot.state === 'DOWN' && snapshot.alarm_code > 0 ? (
          <div className="ml-auto">
            <span className="chip text-down">{t('alarm', { code: snapshot.alarm_code })}</span>
          </div>
        ) : null}
      </dl>
      {footer ? <div className="px-4 pb-3">{footer}</div> : null}
    </article>
  );
}
