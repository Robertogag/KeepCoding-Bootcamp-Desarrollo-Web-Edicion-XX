'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { downtimeSeconds } from '@/components/downtimes/LineDowntimesPanel';
import { IconAlert } from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import { Link } from '@/i18n/navigation';
import { listLineDowntimes } from '@/lib/api/injection';
import { listDowntimeReasons } from '@/lib/api/oee';
import { formatDuration } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';

// Capa informativa: un paro manual de línea no cambia el estado Modbus de la máquina.
export function LineStopBanner({ plantId, machineId }: { plantId: number; machineId: number }) {
  const t = useTranslations('downtimes');
  const locale = useLocale();
  const now = useNow(1000);
  const filters = { machine_id: machineId, open: true, page_size: 5 };
  const query = useQuery({
    queryKey: queryKeys.injection.downtimes(plantId, filters),
    queryFn: () => listLineDowntimes(plantId, filters),
    refetchInterval: 30_000,
  });
  const reasons = useQuery({
    queryKey: queryKeys.reasons,
    queryFn: listDowntimeReasons,
    staleTime: 10 * 60_000,
  });
  const stop = query.data?.items[0];
  if (!stop) return null;
  const reason = reasons.data?.items.find((item) => item.code === stop.reason_code);
  const label = reason ? (locale === 'en' ? reason.label_en : reason.label_es) : stop.reason_code;

  return (
    <Link
      href={`/app/plants/${plantId}/downtimes`}
      className="panel flex items-center gap-3 border-down/50 p-3 text-sm hover:bg-panel-2"
    >
      <IconAlert className="size-5 shrink-0 text-down" />
      <span className="font-semibold text-down">{t('lineStopped')}</span>
      <span className="numeric text-muted" suppressHydrationWarning>
        {t('lineStoppedSince', {
          reason: label,
          duration: formatDuration(downtimeSeconds(stop, now)),
        })}
      </span>
    </Link>
  );
}
