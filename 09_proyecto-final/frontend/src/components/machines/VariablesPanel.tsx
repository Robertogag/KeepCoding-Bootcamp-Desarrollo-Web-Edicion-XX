'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CatalogDialog } from '@/components/catalogs/CatalogDialog';
import { CatalogTable, type CatalogColumn } from '@/components/catalogs/CatalogTable';
import { applyApiError } from '@/components/form/applyApiError';
import { Checkbox, describedBy, Field, Input, Select } from '@/components/form/Field';
import { usePlant } from '@/components/plants/PlantContext';
import { useErrorMessage } from '@/components/state/errorMessage';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconChevronLeft, IconPlus } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { Link } from '@/i18n/navigation';
import { listAllVariables, upsertVariable } from '@/lib/api/injection';
import { getMachine } from '@/lib/api/machines';
import type { MachineVariable, VariableDataType, WordOrder } from '@/lib/api/types';
import { formatDecimal } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import {
  variableSchema,
  type VariableFormInput,
  type VariableFormOutput,
} from '@/lib/validation/injection';

const DATA_TYPES: VariableDataType[] = ['uint16', 'int16', 'uint32', 'int32', 'float32'];
const ORDERS: WordOrder[] = ['big', 'little'];

function VariableDialog({
  machineId,
  item,
  onClose,
}: {
  machineId: number;
  item?: MachineVariable;
  onClose: () => void;
}) {
  const t = useTranslations('variables');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const schema = useMemo(() => variableSchema(tv), [tv]);
  const form = useForm<VariableFormInput, unknown, VariableFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          unit: item.unit,
          address: item.address,
          data_type: item.data_type,
          word_order: item.word_order,
          byte_order: item.byte_order,
          scale: item.scale,
          offset: item.offset,
          is_active: item.is_active,
        }
      : {
          code: '',
          name: '',
          unit: '',
          address: '',
          data_type: 'float32',
          word_order: 'big',
          byte_order: 'big',
          scale: 1,
          offset: 0,
          is_active: true,
        },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (values: VariableFormOutput) =>
      upsertVariable(machineId, values.code, {
        ...values,
        map_version: item?.map_version,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.machines.variables(machineId) });
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  return (
    <CatalogDialog
      title={item ? t('edit') : t('new')}
      formId="variable-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field
          label={t('code')}
          htmlFor="variable-code"
          error={errors.code?.message}
          hint={item ? undefined : t('codeHint')}
        >
          <Input
            id="variable-code"
            spellCheck={false}
            autoCapitalize="none"
            readOnly={!!item}
            invalid={!!errors.code}
            aria-describedby={describedBy('variable-code', errors.code?.message, !item)}
            {...form.register('code')}
          />
        </Field>
        <Field label={t('name')} htmlFor="variable-name" error={errors.name?.message}>
          <Input id="variable-name" invalid={!!errors.name} {...form.register('name')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('unit')} htmlFor="variable-unit" error={errors.unit?.message}>
          <Input id="variable-unit" invalid={!!errors.unit} {...form.register('unit')} />
        </Field>
        <Field label={t('address')} htmlFor="variable-address" error={errors.address?.message}>
          <Input
            id="variable-address"
            type="number"
            inputMode="numeric"
            min={9}
            max={65535}
            invalid={!!errors.address}
            aria-describedby={describedBy('variable-address', errors.address?.message)}
            {...form.register('address')}
          />
        </Field>
        <Field label={t('dataType')} htmlFor="variable-type" error={errors.data_type?.message}>
          <Select id="variable-type" invalid={!!errors.data_type} {...form.register('data_type')}>
            {DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t('wordOrder')} htmlFor="variable-word" error={errors.word_order?.message}>
          <Select id="variable-word" {...form.register('word_order')}>
            {ORDERS.map((order) => (
              <option key={order} value={order}>
                {order}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('byteOrder')} htmlFor="variable-byte" error={errors.byte_order?.message}>
          <Select id="variable-byte" {...form.register('byte_order')}>
            {ORDERS.map((order) => (
              <option key={order} value={order}>
                {order}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('scale')} htmlFor="variable-scale" error={errors.scale?.message}>
          <Input
            id="variable-scale"
            type="number"
            inputMode="decimal"
            step="any"
            invalid={!!errors.scale}
            {...form.register('scale')}
          />
        </Field>
        <Field label={t('offset')} htmlFor="variable-offset" error={errors.offset?.message}>
          <Input
            id="variable-offset"
            type="number"
            inputMode="decimal"
            step="any"
            invalid={!!errors.offset}
            {...form.register('offset')}
          />
        </Field>
      </div>
      <Checkbox label={t('active')} {...form.register('is_active')} />
    </CatalogDialog>
  );
}

export function VariablesPanel({ machineId }: { machineId: number }) {
  const { plant, canEdit } = usePlant();
  const t = useTranslations('variables');
  const locale = useLocale();
  const [editing, setEditing] = useState<MachineVariable | 'new' | null>(null);
  const machine = useQuery({
    queryKey: queryKeys.machines.detail(machineId),
    queryFn: () => getMachine(machineId),
  });
  const query = useQuery({
    queryKey: queryKeys.machines.variables(machineId),
    queryFn: () => listAllVariables(machineId),
  });
  const columns: CatalogColumn<MachineVariable>[] = [
    { key: 'code', label: t('code'), render: (item) => item.code, numeric: true },
    { key: 'name', label: t('name'), render: (item) => item.name },
    { key: 'unit', label: t('unit'), render: (item) => item.unit, numeric: true },
    {
      key: 'address',
      label: t('address'),
      render: (item) => item.address,
      align: 'right',
      numeric: true,
    },
    {
      key: 'type',
      label: t('dataType'),
      render: (item) => `${item.data_type} · ${item.word_order}/${item.byte_order}`,
      hideOnMobile: true,
      numeric: true,
    },
    {
      key: 'scale',
      label: `${t('scale')} / ${t('offset')}`,
      render: (item) =>
        `${formatDecimal(item.scale, locale)} / ${formatDecimal(item.offset, locale)}`,
      hideOnMobile: true,
      numeric: true,
    },
    {
      key: 'map',
      label: t('map'),
      render: (item) => item.map_version,
      hideOnMobile: true,
      numeric: true,
    },
    {
      key: 'state',
      label: t('active'),
      render: (item) => (item.is_active ? t('active') : t('inactive')),
    },
  ];

  return (
    <div className="space-y-4">
      <nav>
        <Link
          href={`/app/plants/${plant.id}/machines/${machineId}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"
        >
          <IconChevronLeft className="size-4" />
          {t('backToMachine')}
        </Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{machine.data?.name ?? ''}</p>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            {canEdit ? t('subtitle') : t('readOnly')}
          </p>
        </div>
        {canEdit ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <IconPlus className="size-4" />
            {t('new')}
          </Button>
        ) : null}
      </div>
      <QueryState query={query} skeleton={<Skeleton className="h-40 w-full" />}>
        {(items) => (
          <CatalogTable
            items={[...items].sort((a, b) => a.address - b.address)}
            columns={columns}
            onEdit={canEdit ? setEditing : undefined}
            emptyTitle={t('empty')}
          />
        )}
      </QueryState>
      {editing ? (
        <VariableDialog
          machineId={machineId}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
