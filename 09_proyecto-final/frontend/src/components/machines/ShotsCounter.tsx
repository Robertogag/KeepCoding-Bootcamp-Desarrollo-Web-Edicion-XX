'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Counter } from '@/components/oee/Counter';
import { listTelemetry } from '@/lib/api/injection';
import { EMPTY_VALUE, formatInteger } from '@/lib/format';
import { latestSample } from './TelemetryPanel';

const MINUTE = 60_000;

// Disparos acumulados del equipo, leídos de la última muestra de telemetría (misma consulta que el panel).
export function ShotsCounter({ machineId }: { machineId: number }) {
  const t = useTranslations('machine');
  const locale = useLocale();
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
  const shots = latest.data ? latestSample(latest.data.items)?.values.shot_count : undefined;
  const value = shots && shots.value !== null ? formatInteger(shots.value, locale) : EMPTY_VALUE;
  return <Counter label={t('shots')} value={value} />;
}
