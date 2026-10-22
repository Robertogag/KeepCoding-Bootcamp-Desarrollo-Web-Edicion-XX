import { z } from 'zod';
import type { Translate } from './auth';

export function alertRuleSchema(t: Translate) {
  return z
    .object({
      type: z.enum(['MACHINE_DOWN', 'MACHINE_OFFLINE', 'OEE_BELOW'], t('required')),
      machine_id: z.union([z.literal(''), z.coerce.number<number | string>().int().positive()]),
      threshold: z.union([
        z.literal(''),
        z.coerce.number<number | string>().min(0, t('threshold')).max(1, t('threshold')),
      ]),
      duration_s: z.coerce
        .number<number | string>()
        .int(t('duration'))
        .min(30, t('duration'))
        .max(86_400, t('duration')),
      is_active: z.boolean(),
    })
    .superRefine((value, context) => {
      if (value.type === 'OEE_BELOW' && value.threshold === '') {
        context.addIssue({ code: 'custom', path: ['threshold'], message: t('threshold') });
      }
    });
}

export type AlertRuleFormInput = z.input<ReturnType<typeof alertRuleSchema>>;
export type AlertRuleFormOutput = z.output<ReturnType<typeof alertRuleSchema>>;
