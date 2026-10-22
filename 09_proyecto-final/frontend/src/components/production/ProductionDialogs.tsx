'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { CatalogDialog } from '@/components/catalogs/CatalogDialog';
import { activeOnly } from '@/components/catalogs/useCatalog';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input, Select } from '@/components/form/Field';
import { useErrorMessage } from '@/components/state/errorMessage';
import { useToast } from '@/components/ui/Toast';
import { createOrder, startRun } from '@/lib/api/injection';
import type { Machine, Mold, ProductionOrder, ProductionRun, Recipe } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/keys';
import {
  orderSchema,
  runStartSchema,
  type OrderFormInput,
  type OrderFormOutput,
  type RunStartFormInput,
  type RunStartFormOutput,
} from '@/lib/validation/injection';

export function OrderDialog({
  plantId,
  recipes,
  onClose,
}: {
  plantId: number;
  recipes: Recipe[];
  onClose: () => void;
}) {
  const t = useTranslations('production');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const schema = useMemo(() => orderSchema(tv), [tv]);
  const form = useForm<OrderFormInput, unknown, OrderFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', recipe_id: '', target_pieces: '' },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (values: OrderFormOutput) => createOrder(plantId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plants', plantId, 'injection', 'orders'] });
      toast({ title: t('orderCreated'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  const active = activeOnly(recipes);
  return (
    <CatalogDialog
      title={t('newOrder')}
      formId="order-form"
      pending={save.isPending}
      alert={alert ?? (active.length === 0 ? t('noRecipes') : null)}
      saveLabel={t('newOrder')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <Field label={t('orderCode')} htmlFor="order-code" error={errors.code?.message}>
        <Input
          id="order-code"
          spellCheck={false}
          invalid={!!errors.code}
          aria-describedby={describedBy('order-code', errors.code?.message)}
          {...form.register('code')}
        />
      </Field>
      <Field label={t('recipe')} htmlFor="order-recipe" error={errors.recipe_id?.message}>
        <Select id="order-recipe" invalid={!!errors.recipe_id} {...form.register('recipe_id')}>
          <option value="">—</option>
          {active.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.code} · {recipe.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('target')} htmlFor="order-target" error={errors.target_pieces?.message}>
        <Input
          id="order-target"
          type="number"
          inputMode="numeric"
          min={1}
          invalid={!!errors.target_pieces}
          aria-describedby={describedBy('order-target', errors.target_pieces?.message)}
          {...form.register('target_pieces')}
        />
      </Field>
    </CatalogDialog>
  );
}

interface StartRunDialogProps {
  plantId: number;
  machines: Machine[];
  orders: ProductionOrder[];
  recipes: Recipe[];
  molds: Mold[];
  openRuns: ProductionRun[];
  initialMachineId?: number;
  onClose: () => void;
  onStarted?: (run: ProductionRun) => void;
}

export function StartRunDialog({
  plantId,
  machines,
  orders,
  recipes,
  molds,
  openRuns,
  initialMachineId,
  onClose,
  onStarted,
}: StartRunDialogProps) {
  const t = useTranslations('production');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const schema = useMemo(() => runStartSchema(tv), [tv]);
  const form = useForm<RunStartFormInput, unknown, RunStartFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { machine_id: initialMachineId ?? '', order_id: '', active_cavities: '' },
  });
  const { errors } = form.formState;
  const orderId = useWatch({ control: form.control, name: 'order_id' });
  const busy = new Set(openRuns.map((run) => run.machine_id));
  const busyMolds = new Set(openRuns.map((run) => run.mold_id));
  const available = machines.filter(
    (machine) => machine.is_active && (!busy.has(machine.id) || machine.id === initialMachineId),
  );
  const planned = orders.filter((order) => {
    if (order.status !== 'planned') return false;
    const recipe = recipes.find((item) => item.id === order.recipe_id);
    return recipe ? !busyMolds.has(recipe.mold_id) : true;
  });
  const recipe = recipes.find(
    (item) => item.id === orders.find((order) => order.id === Number(orderId))?.recipe_id,
  );
  const mold = recipe ? molds.find((item) => item.id === recipe.mold_id) : undefined;

  const save = useMutation({
    mutationFn: (values: RunStartFormOutput) =>
      startRun(values.machine_id, {
        order_id: values.order_id,
        active_cavities: values.active_cavities === '' ? null : values.active_cavities,
      }),
    onSuccess: async (run) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plants', plantId, 'injection'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.machines.context(run.machine_id) }),
      ]);
      toast({ title: t('runStarted'), variant: 'success' });
      onStarted?.(run);
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  return (
    <CatalogDialog
      title={t('startRun')}
      formId="run-form"
      pending={save.isPending}
      alert={alert ?? (planned.length === 0 ? t('noPlannedOrders') : null)}
      saveLabel={t('startRun')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <Field label={t('machine')} htmlFor="run-machine" error={errors.machine_id?.message}>
        <Select
          id="run-machine"
          invalid={!!errors.machine_id}
          disabled={initialMachineId !== undefined}
          {...form.register('machine_id')}
        >
          <option value="">—</option>
          {available.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('order')} htmlFor="run-order" error={errors.order_id?.message}>
        <Select id="run-order" invalid={!!errors.order_id} {...form.register('order_id')}>
          <option value="">—</option>
          {planned.map((order) => {
            const orderRecipe = recipes.find((item) => item.id === order.recipe_id);
            return (
              <option key={order.id} value={order.id}>
                {order.code} · {orderRecipe?.name ?? order.recipe_id} · {order.target_pieces}
              </option>
            );
          })}
        </Select>
      </Field>
      <Field
        label={t('cavities')}
        htmlFor="run-cavities"
        error={errors.active_cavities?.message}
        hint={
          recipe && mold
            ? `${t('cavitiesHint')} ${recipe.active_cavities}/${mold.nominal_cavities}`
            : t('cavitiesHint')
        }
      >
        <Input
          id="run-cavities"
          type="number"
          inputMode="numeric"
          min={1}
          max={mold?.nominal_cavities ?? 1024}
          placeholder={recipe ? String(recipe.active_cavities) : undefined}
          invalid={!!errors.active_cavities}
          aria-describedby={describedBy('run-cavities', errors.active_cavities?.message, true)}
          {...form.register('active_cavities')}
        />
      </Field>
    </CatalogDialog>
  );
}
