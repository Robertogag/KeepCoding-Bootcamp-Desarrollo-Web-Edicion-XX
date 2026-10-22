'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createShift, updateShift } from '@/lib/api/shifts';
import type { Shift } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { shiftSchema, type ShiftFormInput } from '@/lib/validation/shift';
import { DayPicker } from './DayPicker';

interface ShiftDialogProps {
  open: boolean;
  onClose: () => void;
  plantId: number;
  shift?: Shift;
}

export function ShiftDialog({ open, onClose, plantId, shift }: ShiftDialogProps) {
  const t = useTranslations('shifts');
  const tc = useTranslations('common');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const schema = useMemo(() => shiftSchema(tv), [tv]);
  const form = useForm<ShiftFormInput>({
    resolver: zodResolver(schema),
    defaultValues: shift
      ? {
          name: shift.name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          days_of_week: shift.days_of_week,
        }
      : { name: '', start_time: '06:00', end_time: '14:00', days_of_week: [1, 2, 3, 4, 5] },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: (values: ShiftFormInput) =>
      shift ? updateShift(shift.id, values) : createShift(plantId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.shifts(plantId) });
      toast({ title: shift ? t('saved') : t('created'), variant: 'success' });
      form.reset();
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  function close() {
    if (mutation.isPending) return;
    setAlert(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={shift ? t('edit') : t('new')}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
            {tc('cancel')}
          </Button>
          <PendingButton type="submit" form="shift-form" pending={mutation.isPending}>
            {t('save')}
          </PendingButton>
        </>
      }
    >
      <form
        id="shift-form"
        noValidate
        className="space-y-4 text-fg"
        onSubmit={form.handleSubmit((values) => {
          setAlert(null);
          mutation.mutate(values);
        })}
      >
        <FormAlert message={alert} />
        <Field label={t('name')} htmlFor="shift-name" error={errors.name?.message}>
          <Input
            id="shift-name"
            invalid={!!errors.name}
            aria-describedby={describedBy('shift-name', errors.name?.message)}
            {...form.register('name')}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('start')} htmlFor="shift-start" error={errors.start_time?.message}>
            <Input
              id="shift-start"
              type="time"
              step={60}
              invalid={!!errors.start_time}
              aria-describedby={describedBy('shift-start', errors.start_time?.message)}
              {...form.register('start_time')}
            />
          </Field>
          <Field label={t('end')} htmlFor="shift-end" error={errors.end_time?.message}>
            <Input
              id="shift-end"
              type="time"
              step={60}
              invalid={!!errors.end_time}
              aria-describedby={describedBy('shift-end', errors.end_time?.message)}
              {...form.register('end_time')}
            />
          </Field>
        </div>
        <Field label={t('days')} htmlFor="shift-days" error={errors.days_of_week?.message}>
          <Controller
            control={form.control}
            name="days_of_week"
            render={({ field }) => (
              <DayPicker
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.days_of_week}
                describedBy={describedBy('shift-days', errors.days_of_week?.message)}
              />
            )}
          />
        </Field>
      </form>
    </Modal>
  );
}
