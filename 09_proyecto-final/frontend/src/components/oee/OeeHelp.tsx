'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { OeeMetrics } from '@/lib/api/types';
import { EMPTY_VALUE, formatDuration, formatInteger, formatPercent } from '@/lib/format';
import type { ReportTotals } from '@/lib/reports';

interface OeeHelpProps {
  totals?: ReportTotals | null;
  metrics?: OeeMetrics | null;
  className?: string;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={strong ? 'numeric text-sm font-extrabold text-fg' : 'numeric text-sm text-fg'}>
        {value}
      </dd>
    </div>
  );
}

// «Cómo se calcula este OEE»: fórmula, operandos del rango consultado y reglas de unidades.
export function OeeHelp({ totals, metrics, className }: OeeHelpProps) {
  const t = useTranslations('oeeHelp');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const values = totals ?? metrics ?? null;

  return (
    <>
      <Button variant="ghost" size="sm" className={className} onClick={() => setOpen(true)}>
        {t('button')}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('title')}
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {tc('close')}
          </Button>
        }
      >
        <div className="space-y-4 text-fg">
          <p className="text-sm text-muted">{t('intro')}</p>
          <ol className="numeric space-y-1 text-sm">
            <li>{t('availability')}</li>
            <li>{t('performance')}</li>
            <li>{t('quality')}</li>
            <li className="font-bold">{t('oee')}</li>
          </ol>
          {totals ? (
            <dl className="divide-y divide-line rounded-md border border-line px-3">
              <Row label={t('operands.runTime')} value={formatDuration(totals.run_s)} />
              <Row label={t('operands.plannedTime')} value={formatDuration(totals.planned_s)} />
              <Row label={t('operands.good')} value={formatInteger(totals.good, locale)} />
              <Row label={t('operands.reject')} value={formatInteger(totals.reject, locale)} />
              <Row
                label={t('operands.idealTime')}
                value={
                  totals.ideal_s === null ? t('operands.unknown') : formatDuration(totals.ideal_s)
                }
              />
              <Row label="A" value={formatPercent(totals.availability, locale)} />
              <Row
                label={totals.capped ? `P · ${t('capped')}` : 'P'}
                value={formatPercent(totals.performance, locale)}
              />
              <Row label="Q" value={formatPercent(totals.quality, locale)} />
              <Row label="OEE" value={formatPercent(totals.oee, locale)} strong />
            </dl>
          ) : values ? (
            <dl className="divide-y divide-line rounded-md border border-line px-3">
              <Row label="A" value={formatPercent(values.availability, locale)} />
              <Row label="P" value={formatPercent(values.performance, locale)} />
              <Row label="Q" value={formatPercent(values.quality, locale)} />
              <Row label="OEE" value={formatPercent(values.oee, locale) || EMPTY_VALUE} strong />
            </dl>
          ) : null}
          {totals?.ideal_s === null ? (
            <p className="text-sm text-idle">{t('unknownIdeal')}</p>
          ) : null}
          <p className="text-sm text-muted">{t('rounding')}</p>
          <p className="text-sm text-muted">{t('units')}</p>
          <p className="text-sm text-muted">{t('shots')}</p>
          <p className="text-sm text-muted">{t('example')}</p>
          <p className="text-sm text-muted">{t('machineHours')}</p>
        </div>
      </Modal>
    </>
  );
}
