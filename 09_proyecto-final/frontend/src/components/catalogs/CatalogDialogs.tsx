'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { applyApiError } from '@/components/form/applyApiError';
import { Checkbox, describedBy, Field, Input, Select } from '@/components/form/Field';
import { useErrorMessage } from '@/components/state/errorMessage';
import { useToast } from '@/components/ui/Toast';
import { createResinLot } from '@/lib/api/injection';
import type {
  Employee,
  Member,
  Mold,
  Product,
  ProductionLine,
  Recipe,
  Resin,
} from '@/lib/api/types';
import { formatDecimal } from '@/lib/format';
import {
  employeeSchema,
  lineSchema,
  lotSchema,
  moldSchema,
  productSchema,
  recipeSchema,
  resinSchema,
  type EmployeeFormInput,
  type EmployeeFormOutput,
  type LineFormInput,
  type LineFormOutput,
  type LotFormInput,
  type LotFormOutput,
  type MoldFormInput,
  type MoldFormOutput,
  type ProductFormInput,
  type ProductFormOutput,
  type RecipeFormInput,
  type RecipeFormOutput,
  type ResinFormInput,
  type ResinFormOutput,
} from '@/lib/validation/injection';
import { CatalogDialog } from './CatalogDialog';
import { activeOnly, useCatalogSave } from './useCatalog';

interface DialogProps<T> {
  plantId: number;
  item?: T;
  onClose: () => void;
}

function useDialogState() {
  const t = useTranslations('catalogs');
  const tv = useTranslations('validation');
  const describe = useErrorMessage();
  const toast = useToast();
  const [alert, setAlert] = useState<string | null>(null);
  return { t, tv, describe, toast, alert, setAlert };
}

function CommonFields({
  prefix,
  register,
  errors,
  activeHint,
}: {
  prefix: string;
  register: ReturnType<typeof useForm<LineFormInput>>['register'];
  errors: Partial<Record<'code' | 'name', { message?: string }>>;
  activeHint: string;
}) {
  const t = useTranslations('catalogs.columns');
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label={t('code')} htmlFor={`${prefix}-code`} error={errors.code?.message}>
          <Input
            id={`${prefix}-code`}
            autoCapitalize="characters"
            spellCheck={false}
            invalid={!!errors.code}
            aria-describedby={describedBy(`${prefix}-code`, errors.code?.message)}
            {...register('code')}
          />
        </Field>
        <Field label={t('name')} htmlFor={`${prefix}-name`} error={errors.name?.message}>
          <Input
            id={`${prefix}-name`}
            invalid={!!errors.name}
            aria-describedby={describedBy(`${prefix}-name`, errors.name?.message)}
            {...register('name')}
          />
        </Field>
      </div>
      <Checkbox label={t('active')} {...register('is_active')} />
      <p className="text-xs text-muted">{activeHint}</p>
    </>
  );
}

export function LineDialog({ plantId, item, onClose }: DialogProps<ProductionLine>) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const schema = useMemo(() => lineSchema(tv), [tv]);
  const form = useForm<LineFormInput, unknown, LineFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? { code: item.code, name: item.name, is_active: item.is_active }
      : { code: '', name: '', is_active: true },
  });
  const save = useCatalogSave(plantId, 'production-lines', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={item ? t('edit') : t('new.lines')}
      formId="line-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <CommonFields
        prefix="line"
        register={form.register}
        errors={form.formState.errors}
        activeHint={t('fields.activeHint')}
      />
    </CatalogDialog>
  );
}

export function ProductDialog({ plantId, item, onClose }: DialogProps<Product>) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const tc = useTranslations('catalogs.columns');
  const schema = useMemo(() => productSchema(tv), [tv]);
  const form = useForm<ProductFormInput, unknown, ProductFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          is_active: item.is_active,
          part_weight_g: item.part_weight_g,
          description: item.description,
        }
      : { code: '', name: '', is_active: true, part_weight_g: '', description: '' },
  });
  const { errors } = form.formState;
  const save = useCatalogSave(plantId, 'products', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={item ? t('edit') : t('new.products')}
      formId="product-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <CommonFields
        prefix="product"
        register={form.register as unknown as ReturnType<typeof useForm<LineFormInput>>['register']}
        errors={errors}
        activeHint={t('fields.activeHint')}
      />
      <Field
        label={tc('partWeight')}
        htmlFor="product-weight"
        error={errors.part_weight_g?.message}
        hint={t('fields.partWeightHint')}
      >
        <Input
          id="product-weight"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          invalid={!!errors.part_weight_g}
          aria-describedby={describedBy('product-weight', errors.part_weight_g?.message, true)}
          {...form.register('part_weight_g')}
        />
      </Field>
      <Field
        label={tc('description')}
        htmlFor="product-description"
        error={errors.description?.message}
      >
        <Input
          id="product-description"
          invalid={!!errors.description}
          {...form.register('description')}
        />
      </Field>
    </CatalogDialog>
  );
}

export function MoldDialog({ plantId, item, onClose }: DialogProps<Mold>) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const tc = useTranslations('catalogs.columns');
  const schema = useMemo(() => moldSchema(tv), [tv]);
  const form = useForm<MoldFormInput, unknown, MoldFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          is_active: item.is_active,
          nominal_cavities: item.nominal_cavities,
        }
      : { code: '', name: '', is_active: true, nominal_cavities: 4 },
  });
  const { errors } = form.formState;
  const save = useCatalogSave(plantId, 'molds', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={item ? t('edit') : t('new.molds')}
      formId="mold-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <CommonFields
        prefix="mold"
        register={form.register as unknown as ReturnType<typeof useForm<LineFormInput>>['register']}
        errors={errors}
        activeHint={t('fields.activeHint')}
      />
      <Field
        label={tc('cavities')}
        htmlFor="mold-cavities"
        error={errors.nominal_cavities?.message}
      >
        <Input
          id="mold-cavities"
          type="number"
          inputMode="numeric"
          min={1}
          max={1024}
          invalid={!!errors.nominal_cavities}
          aria-describedby={describedBy('mold-cavities', errors.nominal_cavities?.message)}
          {...form.register('nominal_cavities')}
        />
      </Field>
    </CatalogDialog>
  );
}

export function ResinDialog({ plantId, item, onClose }: DialogProps<Resin>) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const tc = useTranslations('catalogs.columns');
  const schema = useMemo(() => resinSchema(tv), [tv]);
  const form = useForm<ResinFormInput, unknown, ResinFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          is_active: item.is_active,
          polymer: item.polymer,
          grade: item.grade,
          manufacturer: item.manufacturer,
        }
      : { code: '', name: '', is_active: true, polymer: '', grade: '', manufacturer: '' },
  });
  const { errors } = form.formState;
  const save = useCatalogSave(plantId, 'resins', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={item ? t('edit') : t('new.resins')}
      formId="resin-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <CommonFields
        prefix="resin"
        register={form.register as unknown as ReturnType<typeof useForm<LineFormInput>>['register']}
        errors={errors}
        activeHint={t('fields.activeHint')}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={tc('polymer')} htmlFor="resin-polymer" error={errors.polymer?.message}>
          <Input id="resin-polymer" invalid={!!errors.polymer} {...form.register('polymer')} />
        </Field>
        <Field label={tc('grade')} htmlFor="resin-grade" error={errors.grade?.message}>
          <Input id="resin-grade" invalid={!!errors.grade} {...form.register('grade')} />
        </Field>
        <Field
          label={tc('manufacturer')}
          htmlFor="resin-manufacturer"
          error={errors.manufacturer?.message}
        >
          <Input
            id="resin-manufacturer"
            invalid={!!errors.manufacturer}
            {...form.register('manufacturer')}
          />
        </Field>
      </div>
    </CatalogDialog>
  );
}

export function EmployeeDialog({
  plantId,
  item,
  members,
  onClose,
}: DialogProps<Employee> & { members: Member[] }) {
  const { tv, describe, toast, alert, setAlert } = useDialogState();
  const t = useTranslations('members.employees');
  const tcat = useTranslations('catalogs');
  const schema = useMemo(() => employeeSchema(tv), [tv]);
  const form = useForm<EmployeeFormInput, unknown, EmployeeFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          is_active: item.is_active,
          user_id: item.user_id ?? '',
        }
      : { code: '', name: '', is_active: true, user_id: '' },
  });
  const { errors } = form.formState;
  const save = useCatalogSave(plantId, 'employees', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={item ? t('edit') : t('new')}
      formId="employee-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={tcat('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate({
          code: values.code,
          name: values.name,
          is_active: values.is_active,
          user_id: values.user_id === '' ? null : values.user_id,
        });
      })}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label={t('code')} htmlFor="employee-code" error={errors.code?.message}>
          <Input
            id="employee-code"
            spellCheck={false}
            invalid={!!errors.code}
            aria-describedby={describedBy('employee-code', errors.code?.message)}
            {...form.register('code')}
          />
        </Field>
        <Field label={t('name')} htmlFor="employee-name" error={errors.name?.message}>
          <Input
            id="employee-name"
            invalid={!!errors.name}
            aria-describedby={describedBy('employee-name', errors.name?.message)}
            {...form.register('name')}
          />
        </Field>
      </div>
      <Field label={t('account')} htmlFor="employee-user" error={errors.user_id?.message}>
        <Select id="employee-user" invalid={!!errors.user_id} {...form.register('user_id')}>
          <option value="">{t('noAccount')}</option>
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.full_name} · @{member.username}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox label={t('active')} {...form.register('is_active')} />
    </CatalogDialog>
  );
}

interface RecipeDialogProps extends DialogProps<Recipe> {
  products: Product[];
  molds: Mold[];
  resins: Resin[];
}

export function RecipeDialog({
  plantId,
  item,
  products,
  molds,
  resins,
  onClose,
}: RecipeDialogProps) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const tc = useTranslations('catalogs.columns');
  const locale = useLocale();
  const nominalOf = (moldId: number) =>
    molds.find((mold) => mold.id === moldId)?.nominal_cavities ?? null;
  const schema = useMemo(
    () =>
      recipeSchema(
        tv,
        (moldId) => molds.find((mold) => mold.id === moldId)?.nominal_cavities ?? null,
      ),
    [tv, molds],
  );
  const form = useForm<RecipeFormInput, unknown, RecipeFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: item
      ? {
          code: item.code,
          name: item.name,
          is_active: item.is_active,
          product_id: item.product_id,
          mold_id: item.mold_id,
          resin_id: item.resin_id,
          ideal_cycle_s: item.ideal_cycle_s,
          active_cavities: item.active_cavities,
        }
      : {
          code: '',
          name: '',
          is_active: true,
          product_id: '',
          mold_id: '',
          resin_id: '',
          ideal_cycle_s: '',
          active_cavities: '',
        },
  });
  const { errors } = form.formState;
  const moldId = useWatch({ control: form.control, name: 'mold_id' });
  const cycle = useWatch({ control: form.control, name: 'ideal_cycle_s' });
  const cavities = useWatch({ control: form.control, name: 'active_cavities' });
  const nominal = nominalOf(Number(moldId));
  const perPiece =
    Number(cycle) > 0 && Number(cavities) > 0 ? Number(cycle) / Number(cavities) : null;
  const save = useCatalogSave(plantId, 'injection-recipes', item?.id, {
    onSuccess: () => {
      toast({ title: item ? t('saved') : t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });

  const selectable = <T extends { id: number; is_active: boolean }>(items: T[], current?: number) =>
    items.filter((entry) => entry.is_active || entry.id === current);

  return (
    <CatalogDialog
      title={item ? t('edit') : t('new.recipes')}
      formId="recipe-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <CommonFields
        prefix="recipe"
        register={form.register as unknown as ReturnType<typeof useForm<LineFormInput>>['register']}
        errors={errors}
        activeHint={t('fields.activeHint')}
      />
      <Field label={tc('product')} htmlFor="recipe-product" error={errors.product_id?.message}>
        <Select id="recipe-product" invalid={!!errors.product_id} {...form.register('product_id')}>
          <option value="">—</option>
          {selectable(products, item?.product_id).map((product) => (
            <option key={product.id} value={product.id}>
              {product.code} · {product.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tc('mold')} htmlFor="recipe-mold" error={errors.mold_id?.message}>
          <Select id="recipe-mold" invalid={!!errors.mold_id} {...form.register('mold_id')}>
            <option value="">—</option>
            {selectable(molds, item?.mold_id).map((mold) => (
              <option key={mold.id} value={mold.id}>
                {mold.code} · {mold.name} · {mold.nominal_cavities}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tc('resin')} htmlFor="recipe-resin" error={errors.resin_id?.message}>
          <Select id="recipe-resin" invalid={!!errors.resin_id} {...form.register('resin_id')}>
            <option value="">—</option>
            {selectable(resins, item?.resin_id).map((resin) => (
              <option key={resin.id} value={resin.id}>
                {resin.code} · {resin.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={tc('idealCycle')}
          htmlFor="recipe-cycle"
          error={errors.ideal_cycle_s?.message}
          hint={t('fields.idealCycleHint')}
        >
          <Input
            id="recipe-cycle"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0.1}
            max={3600}
            invalid={!!errors.ideal_cycle_s}
            aria-describedby={describedBy('recipe-cycle', errors.ideal_cycle_s?.message, true)}
            {...form.register('ideal_cycle_s')}
          />
        </Field>
        <Field
          label={tc('activeCavities')}
          htmlFor="recipe-cavities"
          error={errors.active_cavities?.message}
          hint={
            nominal === null
              ? t('fields.activeCavitiesHint')
              : `${t('fields.activeCavitiesHint')} (${nominal})`
          }
        >
          <Input
            id="recipe-cavities"
            type="number"
            inputMode="numeric"
            min={1}
            max={nominal ?? 1024}
            invalid={!!errors.active_cavities}
            aria-describedby={describedBy('recipe-cavities', errors.active_cavities?.message, true)}
            {...form.register('active_cavities')}
          />
        </Field>
      </div>
      {perPiece !== null ? (
        <p className="numeric text-sm text-muted">
          {t('perPiece', { seconds: formatDecimal(perPiece, locale) })}
        </p>
      ) : null}
    </CatalogDialog>
  );
}

export function LotDialog({
  plantId,
  resins,
  onClose,
}: {
  plantId: number;
  resins: Resin[];
  onClose: () => void;
}) {
  const { t, tv, describe, toast, alert, setAlert } = useDialogState();
  const tc = useTranslations('catalogs.columns');
  const queryClient = useQueryClient();
  const schema = useMemo(() => lotSchema(tv), [tv]);
  const form = useForm<LotFormInput, unknown, LotFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { resin_id: '', lot_code: '', received_kg: '' },
  });
  const { errors } = form.formState;
  const save = useMutation({
    mutationFn: (values: LotFormOutput) => createResinLot(plantId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['plants', plantId, 'injection', 'lots'],
      });
      toast({ title: t('created'), variant: 'success' });
      onClose();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  return (
    <CatalogDialog
      title={t('new.lots')}
      formId="lot-form"
      pending={save.isPending}
      alert={alert}
      saveLabel={t('save')}
      onClose={onClose}
      onSubmit={form.handleSubmit((values) => {
        setAlert(null);
        save.mutate(values);
      })}
    >
      <Field label={tc('resin')} htmlFor="lot-resin" error={errors.resin_id?.message}>
        <Select id="lot-resin" invalid={!!errors.resin_id} {...form.register('resin_id')}>
          <option value="">—</option>
          {activeOnly(resins).map((resin) => (
            <option key={resin.id} value={resin.id}>
              {resin.code} · {resin.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tc('lotCode')} htmlFor="lot-code" error={errors.lot_code?.message}>
          <Input
            id="lot-code"
            spellCheck={false}
            invalid={!!errors.lot_code}
            aria-describedby={describedBy('lot-code', errors.lot_code?.message)}
            {...form.register('lot_code')}
          />
        </Field>
        <Field
          label={tc('receivedKg')}
          htmlFor="lot-kg"
          error={errors.received_kg?.message}
          hint={t('fields.lotHint')}
        >
          <Input
            id="lot-kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            invalid={!!errors.received_kg}
            aria-describedby={describedBy('lot-kg', errors.received_kg?.message, true)}
            {...form.register('received_kg')}
          />
        </Field>
      </div>
    </CatalogDialog>
  );
}
