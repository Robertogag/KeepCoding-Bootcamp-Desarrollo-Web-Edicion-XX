import { z } from 'zod';
import type { Translate } from './auth';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function shiftSchema(t: Translate) {
  return z
    .object({
      name: z.string().trim().min(1, t('shiftName')).max(40, t('shiftName')),
      start_time: z.string().regex(TIME, t('time')),
      end_time: z.string().regex(TIME, t('time')),
      days_of_week: z.array(z.number().int().min(1).max(7)).min(1, t('days')),
    })
    .refine((value) => value.start_time !== value.end_time, {
      path: ['end_time'],
      error: t('shiftSameTime'),
    });
}

export type ShiftFormInput = z.infer<ReturnType<typeof shiftSchema>>;
