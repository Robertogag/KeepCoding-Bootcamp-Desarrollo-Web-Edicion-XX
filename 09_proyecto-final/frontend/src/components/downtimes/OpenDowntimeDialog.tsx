'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CatalogDialog } from '@/components/catalogs/CatalogDialog';
import { applyApiError } from '@/components/form/applyApiError';
import { Checkbox, Field, inputClasses, Select } from '@/components/form/Field';
import { useErrorMessage } from '@/components/state/errorMessage';
import { useToast } from '@/components/ui/Toast';
import { openLineDowntime } from '@/lib/api/injection';
import { listDowntimeReasons } from '@/lib/api/oee';
import type { ProductionLine } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import {
  downtimeSchema,
  type DowntimeFormInput,
  type DowntimeFormOutput,
} from '@/lib/validation/injection';

export function OpenDowntimeDialog({
  plantId,
  lines,
  initialLineId,
  onClose,
}: {
  plantId: number;
  lines: ProductionLine[];
  initialLineId?: number;
  onClose: () => void;
}) {
  const t = useTranslations('downtimes');
  const tv = useTranslations('validation');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const reasons = useQuery({
    queryKey: queryKeys.reasons,
    queryFn: listDowntimeReasons,
    staleTime: 10 * 60_000,
  });
  const schema = useMemo(() => downtimeSchema(tv), [tv]);
  const form = useForm<DowntimeFormInput, unknown, DowntimeFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { line_id: initialLineId ?? '', reason_code: '', planned: false, comment: '' },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (values: DowntimeFormOutput) =>
      openLineDowntime(values.line_id, {
        reason_code: values.reason_code,
        planned: values.planned,
        comment: values.comment || undefined,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plants', plantId, 'injection', 'downtimes'] }),
        queryClient.invalidateQueries({ queryKey: ['plants', plantId, 'board'] }),
      ]);
      toast({ title: t('opened'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  return (
    <CatalogDialog
      title={t('new')}
      formId="downtime-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('new')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <Field label={t('line')} htmlFor="downtime-line" error={errors.line_id?.message}>
        <Select id="downtime-line" invalid={!!errors.line_id} {...form.register('line_id')}>
          <option value="">—</option>
          {lines
            .filter((line) => line.is_active)
            .map((line) => (
              <option key={line.id} value={line.id}>
                {line.code} · {line.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label={t('reason')} htmlFor="downtime-reason" error={errors.reason_code?.message}>
        <Select
          id="downtime-reason"
          invalid={!!errors.reason_code}
          disabled={reasons.isPending}
          {...form.register('reason_code')}
        >
          <option value="">—</option>
          {[...(reasons.data?.items ?? [])]
            .sort((a, b) => Number(a.code) - Number(b.code))
            .map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.code} · {locale === 'en' ? reason.label_en : reason.label_es}
              </option>
            ))}
        </Select>
      </Field>
      <Checkbox label={t('plannedLabel')} {...form.register('planned')} />
      <Field label={t('comment')} htmlFor="downtime-comment" error={errors.comment?.message}>
        <textarea
          id="downtime-comment"
          rows={3}
          maxLength={500}
          className={`${inputClasses} h-auto py-2`}
          {...form.register('comment')}
        />
      </Field>
    </CatalogDialog>
  );
}
