import type { AppNotification } from '@/lib/api/types';
import { formatDuration, formatPercent } from '@/lib/format';

type Translator = (key: string, values?: Record<string, string | number>) => string;

export function describeNotification(
  notification: AppNotification,
  t: Translator,
  locale: string,
): string {
  const payload = notification.payload;
  switch (notification.type) {
    case 'MACHINE_DOWN':
      return t('types.MACHINE_DOWN', {
        machine: payload.machine_name,
        duration: formatDuration(payload.duration_s ?? 0),
        reason: payload.reason_code ? t('reasonSuffix', { code: payload.reason_code }) : '',
      });
    case 'MACHINE_OFFLINE':
      return t('types.MACHINE_OFFLINE', {
        machine: payload.machine_name,
        duration: formatDuration(payload.duration_s ?? 0),
      });
    case 'OEE_BELOW':
      return t('types.OEE_BELOW', {
        machine: payload.machine_name,
        oee: formatPercent(payload.oee ?? null, locale),
        threshold: formatPercent(payload.threshold ?? null, locale),
      });
  }
}

export function machinePath(notification: AppNotification): string {
  return `/app/plants/${notification.payload.plant_id}/machines/${notification.payload.machine_id}`;
}
