'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { Checkbox, describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createAlertRule, updateAlertRule } from '@/lib/api/alerts';
import type { AlertRule, AlertType, Machine } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import {
  alertRuleSchema,
  type AlertRuleFormInput,
  type AlertRuleFormOutput,
} from '@/lib/validation/alert';

const TYPES: AlertType[] = ['MACHINE_DOWN', 'MACHINE_OFFLINE', 'OEE_BELOW'];

interface AlertRuleDialogProps {
  plantId: number;
  machines: Machine[];
  rule?: AlertRule;
  onClose: () => void;
}

export function AlertRuleDialog({ plantId, machines, rule, onClose }: AlertRuleDialogProps) {
  const t = useTranslations('alerts');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const schema = useMemo(() => alertRuleSchema(tv), [tv]);
  const form = useForm<AlertRuleFormInput, unknown, AlertRuleFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: rule
      ? {
          type: rule.type,
          machine_id: rule.machine_id ?? '',
          threshold: rule.threshold ?? '',
          duration_s: rule.duration_s,
          is_active: rule.is_active,
        }
      : { type: 'MACHINE_DOWN', machine_id: '', threshold: '', duration_s: 300, is_active: true },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: 'type' });

  const mutation = useMutation({
    mutationFn: (values: AlertRuleFormOutput) => {
      const payload = {
        type: values.type,
        machine_id: values.machine_id === '' ? null : values.machine_id,
        threshold: values.type === 'OEE_BELOW' && values.threshold !== '' ? values.threshold : null,
        duration_s: values.duration_s,
        is_active: values.is_active,
      };
      return rule ? updateAlertRule(rule.id, payload) : createAlertRule(plantId, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.alertRules(plantId) });
      toast({ title: rule ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  function close() {
    if (!mutation.isPending) onClose();
  }

  return (
    <Modal
      open
      onClose={close}
      title={rule ? t('edit') : t('new')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <PendingButton type="submit" form="alert-rule-form" pending={mutation.isPending}>
            {t('save')}
          </PendingButton>
        </>
      }
    >
      <form
        id="alert-rule-form"
        noValidate
        className="space-y-4 text-fg"
        onSubmit={form.handleSubmit((values) => {
          setAlert(null);
          mutation.mutate(values);
        })}
      >
        <FormAlert message={alert} />
        <Field label={t('type')} htmlFor="rule-type" error={errors.type?.message}>
          <Select id="rule-type" invalid={!!errors.type} {...form.register('type')}>
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {t(`types.${item}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('scope')} htmlFor="rule-machine" error={errors.machine_id?.message}>
          <Select id="rule-machine" invalid={!!errors.machine_id} {...form.register('machine_id')}>
            <option value="">{t('allMachines')}</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.name}
              </option>
            ))}
          </Select>
        </Field>
        {type === 'OEE_BELOW' ? (
          <Field
            label={t('threshold')}
            htmlFor="rule-threshold"
            error={errors.threshold?.message}
            hint={t('thresholdHint')}
          >
            <Input
              id="rule-threshold"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={1}
              invalid={!!errors.threshold}
              aria-describedby={describedBy('rule-threshold', errors.threshold?.message, true)}
              {...form.register('threshold')}
            />
          </Field>
        ) : null}
        <Field
          label={t('duration')}
          htmlFor="rule-duration"
          error={errors.duration_s?.message}
          hint={t('durationHint')}
        >
          <Input
            id="rule-duration"
            type="number"
            inputMode="numeric"
            min={30}
            max={86400}
            invalid={!!errors.duration_s}
            aria-describedby={describedBy('rule-duration', errors.duration_s?.message, true)}
            {...form.register('duration_s')}
          />
        </Field>
        <Checkbox label={t('active')} {...form.register('is_active')} />
      </form>
    </Modal>
  );
}
