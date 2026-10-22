import { z } from 'zod';
import type { Translate } from './auth';

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const HOSTNAME =
  /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isHost(value: string): boolean {
  // Algo solo con dígitos y puntos es una IP mal escrita, no un hostname.
  if (/^[\d.]+$/.test(value)) return IPV4.test(value);
  return HOSTNAME.test(value);
}

function hasOneDecimalAtMost(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;
}

export function machineSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(2, t('machineName')).max(60, t('machineName')),
    brand: z.string().trim().max(40, t('brand')),
    model: z.string().trim().max(40, t('model')),
    host: z.string().trim().refine(isHost, t('host')),
    port: z.coerce.number<number | string>().int(t('port')).min(1, t('port')).max(65535, t('port')),
    unit_id: z.coerce
      .number<number | string>()
      .int(t('unitId'))
      .min(1, t('unitId'))
      .max(247, t('unitId')),
    ideal_cycle_s: z.coerce
      .number<number | string>()
      .min(0.1, t('idealCycle'))
      .max(3600, t('idealCycle'))
      .refine(hasOneDecimalAtMost, t('idealCycle')),
    is_active: z.boolean(),
  });
}

export function connectionSchema(t: Translate) {
  return machineSchema(t).pick({ host: true, port: true, unit_id: true });
}

export type MachineFormInput = z.input<ReturnType<typeof machineSchema>>;
export type MachineFormOutput = z.output<ReturnType<typeof machineSchema>>;
