'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { Checkbox, describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { createPlant, updatePlant } from '@/lib/api/plants';
import type { Plant } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import { guessTimeZone, listTimeZones } from '@/lib/timezones';
import { plantSchema, type PlantFormInput } from '@/lib/validation/plant';

interface PlantFormProps {
  plant?: Plant;
}

export function PlantForm({ plant }: PlantFormProps) {
  const t = useTranslations('plants');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const schema = useMemo(() => plantSchema(tv), [tv]);
  const timeZones = useMemo(() => listTimeZones(), []);
  const form = useForm<PlantFormInput>({
    resolver: zodResolver(schema),
    defaultValues: plant
      ? { name: plant.name, timezone: plant.timezone, is_public: plant.is_public }
      : { name: '', timezone: guessTimeZone(), is_public: false },
  });
  const [alert, setAlert] = useState<string | null>(null);
  const { errors, isDirty } = form.formState;

  const mutation = useMutation({
    mutationFn: (values: PlantFormInput) =>
      plant ? updatePlant(plant.id, values) : createPlant(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.all });
      if (plant) {
        queryClient.setQueryData(queryKeys.plants.detail(saved.id), saved);
        form.reset({ name: saved.name, timezone: saved.timezone, is_public: saved.is_public });
        toast({ title: t('saved'), variant: 'success' });
        return;
      }
      toast({ title: t('created'), variant: 'success' });
      router.push(`/app/plants/${saved.id}`);
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        mutation.mutate(values);
      })}
    >
      <FormAlert message={alert} />
      <Field label={t('name')} htmlFor="plant-name" error={errors.name?.message}>
        <Input
          id="plant-name"
          invalid={!!errors.name}
          aria-describedby={describedBy('plant-name', errors.name?.message)}
          {...form.register('name')}
        />
      </Field>
      <Field
        label={t('timezone')}
        htmlFor="plant-timezone"
        error={errors.timezone?.message}
        hint={t('timezoneHint')}
      >
        <Select
          id="plant-timezone"
          invalid={!!errors.timezone}
          aria-describedby={describedBy('plant-timezone', errors.timezone?.message, true)}
          {...form.register('timezone')}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-1">
        <Checkbox label={t('isPublic')} {...form.register('is_public')} />
        <p className="text-sm text-muted">{t('isPublicHint')}</p>
      </div>
      <div className="flex justify-end">
        <PendingButton
          type="submit"
          pending={mutation.isPending}
          disabled={plant ? !isDirty : false}
        >
          {plant ? t('save') : t('create')}
        </PendingButton>
      </div>
    </form>
  );
}
