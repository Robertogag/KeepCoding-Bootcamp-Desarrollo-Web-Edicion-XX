'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { useCatalog } from '@/components/catalogs/useCatalog';
import { Checkbox, describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { usePlant } from '@/components/plants/PlantContext';
import { ResponsivePhoto } from '@/components/public/ResponsivePhoto';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from '@/i18n/navigation';
import { setMachineLine } from '@/lib/api/injection';
import {
  createMachine,
  testConnection,
  updateMachine,
  uploadMachinePhoto,
} from '@/lib/api/machines';
import type { ConnectionTest, Machine } from '@/lib/api/types';
import { formatDecimal, formatInteger } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import {
  connectionSchema,
  machineSchema,
  type MachineFormInput,
  type MachineFormOutput,
} from '@/lib/validation/machine';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function PhotoPreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <img
      src={url}
      alt=""
      className="aspect-[3/2] w-full rounded-lg border border-line object-cover"
    />
  );
}

export function MachineForm({ machine }: { machine?: Machine }) {
  const { plant } = usePlant();
  const t = useTranslations('machines.form');
  const tv = useTranslations('validation');
  const te = useTranslations('errors');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const schema = useMemo(() => machineSchema(tv), [tv]);
  const form = useForm<MachineFormInput, unknown, MachineFormOutput>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: machine
      ? {
          name: machine.name,
          brand: machine.brand,
          model: machine.model,
          host: machine.host,
          port: machine.port,
          unit_id: machine.unit_id,
          ideal_cycle_s: machine.ideal_cycle_s,
          is_active: machine.is_active,
        }
      : {
          name: '',
          brand: '',
          model: '',
          host: '',
          port: 502,
          unit_id: 1,
          ideal_cycle_s: 30,
          is_active: true,
        },
  });
  const { errors } = form.formState;
  const lines = useCatalog(plant.id, 'production-lines');
  const [lineId, setLineId] = useState(machine?.line_id ? String(machine.line_id) : '');
  const [alert, setAlert] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    { ok: true; data: ConnectionTest } | { ok: false; message: string } | null
  >(null);

  const test = useMutation({
    mutationFn: async () => {
      const values = connectionSchema(tv).safeParse(form.getValues());
      if (!values.success) {
        for (const issue of values.error.issues) {
          const field = issue.path[0];
          if (field === 'host' || field === 'port' || field === 'unit_id') {
            form.setError(field, { type: 'manual', message: issue.message });
          }
        }
        throw new Error('invalid');
      }
      return testConnection(plant.id, values.data);
    },
    onSuccess: (data) => setTestResult({ ok: true, data }),
    onError: (error) => {
      if (error instanceof Error && error.message === 'invalid') return;
      setTestResult({ ok: false, message: describe(error) });
    },
  });

  const save = useMutation({
    mutationFn: async (values: MachineFormOutput) => {
      const saved = machine
        ? await updateMachine(machine.id, values)
        : await createMachine(plant.id, values);
      const withPhoto = photo ? await uploadMachinePhoto(saved.id, photo) : saved;
      // La línea se guarda aparte porque tiene su propia ruta y sus propias reglas de paro.
      const nextLine = lineId === '' ? null : Number(lineId);
      if (nextLine !== (machine?.line_id ?? null)) {
        await setMachineLine(saved.id, nextLine);
        return { ...withPhoto, line_id: nextLine };
      }
      return withPhoto;
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.machines.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.plants.all });
      toast({ title: machine ? t('saved') : t('created'), variant: 'success' });
      router.push(`/app/plants/${plant.id}/machines/${saved.id}`);
    },
    onError: (error) => setAlert(applyApiError(error, form, describe, { file: 'name' })),
  });

  function choosePhoto(file: File | null) {
    setPhotoError(null);
    if (!file) {
      setPhoto(null);
      return;
    }
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError(te('UNSUPPORTED_FILE'));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoError(te('FILE_TOO_LARGE'));
      return;
    }
    setPhoto(file);
  }

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]"
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <div className="space-y-4">
        <FormAlert message={alert} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('name')}
            htmlFor="machine-name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input
              id="machine-name"
              invalid={!!errors.name}
              aria-describedby={describedBy('machine-name', errors.name?.message)}
              {...form.register('name')}
            />
          </Field>
          <Field label={t('brand')} htmlFor="machine-brand" error={errors.brand?.message}>
            <Input id="machine-brand" invalid={!!errors.brand} {...form.register('brand')} />
          </Field>
          <Field label={t('model')} htmlFor="machine-model" error={errors.model?.message}>
            <Input id="machine-model" invalid={!!errors.model} {...form.register('model')} />
          </Field>
        </div>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="eyebrow px-1">Modbus TCP</legend>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label={t('host')} htmlFor="machine-host" error={errors.host?.message}>
              <Input
                id="machine-host"
                autoCapitalize="none"
                spellCheck={false}
                invalid={!!errors.host}
                aria-describedby={describedBy('machine-host', errors.host?.message)}
                {...form.register('host')}
              />
            </Field>
            <Field label={t('port')} htmlFor="machine-port" error={errors.port?.message}>
              <Input
                id="machine-port"
                type="number"
                inputMode="numeric"
                min={1}
                max={65535}
                invalid={!!errors.port}
                aria-describedby={describedBy('machine-port', errors.port?.message)}
                {...form.register('port')}
              />
            </Field>
            <Field label={t('unitId')} htmlFor="machine-unit" error={errors.unit_id?.message}>
              <Input
                id="machine-unit"
                type="number"
                inputMode="numeric"
                min={1}
                max={247}
                invalid={!!errors.unit_id}
                aria-describedby={describedBy('machine-unit', errors.unit_id?.message)}
                {...form.register('unit_id')}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PendingButton
              type="button"
              variant="secondary"
              size="sm"
              pending={test.isPending}
              onClick={() => test.mutate()}
            >
              {t('test')}
            </PendingButton>
            {testResult ? (
              <p
                role="status"
                className={testResult.ok ? 'text-sm text-running' : 'text-sm text-down'}
              >
                {testResult.ok ? (
                  <>
                    <span className="font-medium">
                      {t('testOk', { latency: Math.round(testResult.data.latency_ms) })}
                    </span>
                    <span className="text-muted">
                      {' · '}
                      {t('testRegisters', {
                        state: testResult.data.registers.state,
                        good: formatInteger(testResult.data.registers.good_count, locale),
                        reject: formatInteger(testResult.data.registers.reject_count, locale),
                        cycle: formatDecimal(testResult.data.registers.ideal_cycle_ds / 10, locale),
                      })}
                    </span>
                  </>
                ) : (
                  testResult.message
                )}
              </p>
            ) : null}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('idealCycle')}
            htmlFor="machine-cycle"
            error={errors.ideal_cycle_s?.message}
            hint={t('idealCycleHint')}
          >
            <Input
              id="machine-cycle"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0.1}
              max={3600}
              invalid={!!errors.ideal_cycle_s}
              aria-describedby={describedBy('machine-cycle', errors.ideal_cycle_s?.message, true)}
              {...form.register('ideal_cycle_s')}
            />
          </Field>
          <Field label={t('line')} htmlFor="machine-line" hint={t('lineHint')}>
            <Select
              id="machine-line"
              value={lineId}
              onChange={(event) => setLineId(event.target.value)}
              disabled={lines.isPending}
            >
              <option value="">{t('noLine')}</option>
              {(lines.data ?? [])
                .filter((line) => line.is_active || line.id === machine?.line_id)
                .map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.code} · {line.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label={t('isActive')} {...form.register('is_active')} />
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <p className="text-sm font-medium">{t('photo')}</p>
        {photo ? (
          <PhotoPreview file={photo} />
        ) : (
          <ResponsivePhoto photo={machine?.photo ?? null} alt={machine?.name ?? ''} sizes="320px" />
        )}
        <label className="block">
          <span className="sr-only">{t('photo')}</span>
          <input
            type="file"
            accept={PHOTO_TYPES.join(',')}
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-panel file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg hover:file:bg-panel-2"
          />
        </label>
        {photoError ? (
          <p role="alert" className="text-sm text-down">
            {photoError}
          </p>
        ) : photo ? (
          <p className="text-sm text-muted">{t('photoSelected', { name: photo.name })}</p>
        ) : (
          <p className="text-sm text-muted">{t('photoHint')}</p>
        )}
        <div className="flex justify-end pt-2">
          <PendingButton type="submit" pending={save.isPending}>
            {t('save')}
          </PendingButton>
        </div>
      </aside>
    </form>
  );
}
