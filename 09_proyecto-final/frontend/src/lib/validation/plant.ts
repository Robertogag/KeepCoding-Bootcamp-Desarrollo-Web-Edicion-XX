import { z } from 'zod';
import { isValidTimeZone } from '@/lib/time';
import type { Translate } from './auth';

export function plantSchema(t: Translate) {
  return z.object({
    name: z.string().trim().min(2, t('plantName')).max(80, t('plantName')),
    timezone: z.string().refine(isValidTimeZone, t('timezone')),
    is_public: z.boolean(),
  });
}

export type PlantFormInput = z.infer<ReturnType<typeof plantSchema>>;
