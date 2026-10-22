'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { activeOnly, useCatalog } from '@/components/catalogs/useCatalog';
import { applyApiError } from '@/components/form/applyApiError';
import { describedBy, Field, Input, Select } from '@/components/form/Field';
import { FormAlert } from '@/components/form/FormAlert';
import { useErrorMessage } from '@/components/state/errorMessage';
import { PendingButton } from '@/components/state/PendingButton';
import { QueryState } from '@/components/state/QueryState';
import { Skeleton } from '@/components/state/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useNow } from '@/hooks/useNow';
import {
  addRunMaterial,
  assignRunEmployee,
  endRunAssignment,
  getTraceability,
  listResinLots,
} from '@/lib/api/injection';
import type { AssignmentRole, ProductionRun, Traceability } from '@/lib/api/types';
import { EMPTY_VALUE, formatDateTime, formatDecimal, formatDuration } from '@/lib/format';
import { queryKeys } from '@/lib/query/keys';
import {
  assignmentSchema,
  materialSchema,
  type AssignmentFormInput,
  type AssignmentFormOutput,
  type MaterialFormInput,
  type MaterialFormOutput,
} from '@/lib/validation/injection';

const ROLES: AssignmentRole[] = ['operator', 'technician', 'quality', 'supervisor'];
const LOTS = { page_size: 100 };

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="truncate text-sm">{value}</dd>
    </div>
  );
}

export function runDuration(run: ProductionRun, now: number): number {
  const start = new Date(run.started_at).getTime();
  const end = run.ended_at ? new Date(run.ended_at).getTime() : now;
  return Math.max(0, (end - start) / 1000);
}

function MaterialsSection({
  data,
  plantId,
  canEdit,
  timeZone,
}: {
  data: Traceability;
  plantId: number;
  canEdit: boolean;
  timeZone: string;
}) {
  const t = useTranslations('production');
  const tv = useTranslations('validation');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const lots = useQuery({
    queryKey: queryKeys.injection.lots(plantId, { ...LOTS, resin_id: data.run.context.resin_id }),
    queryFn: () => listResinLots(plantId, { ...LOTS, resin_id: data.run.context.resin_id }),
    enabled: canEdit && data.run.ended_at === null,
  });
  const schema = useMemo(() => materialSchema(tv), [tv]);
  const form = useForm<MaterialFormInput, unknown, MaterialFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { resin_lot_id: '', consumed_kg: '' },
  });
  const { errors } = form.formState;
  const add = useMutation({
    mutationFn: (values: MaterialFormOutput) => addRunMaterial(data.run.id, values),
    onSuccess: async () => {
      form.reset();
      toast({ title: t('materialAdded'), variant: 'success' });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.injection.traceability(data.run.id),
      });
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  const lotLabel = (id: number) =>
    lots.data?.items.find((lot) => lot.id === id)?.lot_code ?? `#${id}`;

  return (
    <section className="space-y-2">
      <h3 className="eyebrow">{t('materials')}</h3>
      {data.materials.length === 0 ? (
        <p className="text-sm text-muted">{t('noMaterials')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {data.materials.map((material) => (
            <li key={material.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="numeric">{lotLabel(material.resin_lot_id)}</span>
              <span className="text-muted">
                {formatDateTime(material.recorded_at, timeZone, locale)}
              </span>
              <span className="numeric">{formatDecimal(material.consumed_kg, locale)} kg</span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && data.run.ended_at === null ? (
        <form
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={form.handleSubmit((values) => {
            setAlert(null);
            add.mutate(values);
          })}
        >
          <FormAlert message={alert} className="basis-full" />
          <Field
            label={t('lot')}
            htmlFor="material-lot"
            error={errors.resin_lot_id?.message}
            className="min-w-40 flex-1"
          >
            <Select
              id="material-lot"
              invalid={!!errors.resin_lot_id}
              disabled={lots.isPending}
              {...form.register('resin_lot_id')}
            >
              <option value="">—</option>
              {(lots.data?.items ?? []).map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lot_code} · {formatDecimal(lot.received_kg, locale)} kg
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('kg')}
            htmlFor="material-kg"
            error={errors.consumed_kg?.message}
            className="w-32"
          >
            <Input
              id="material-kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              invalid={!!errors.consumed_kg}
              aria-describedby={describedBy('material-kg', errors.consumed_kg?.message)}
              {...form.register('consumed_kg')}
            />
          </Field>
          <PendingButton type="submit" size="md" variant="secondary" pending={add.isPending}>
            {t('addMaterial')}
          </PendingButton>
        </form>
      ) : null}
    </section>
  );
}

function CrewSection({
  data,
  plantId,
  canEdit,
  timeZone,
}: {
  data: Traceability;
  plantId: number;
  canEdit: boolean;
  timeZone: string;
}) {
  const t = useTranslations('production');
  const tv = useTranslations('validation');
  const locale = useLocale();
  const describe = useErrorMessage();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<string | null>(null);
  const employees = useCatalog(plantId, 'employees');
  const schema = useMemo(() => assignmentSchema(tv), [tv]);
  const form = useForm<AssignmentFormInput, unknown, AssignmentFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { employee_id: '', role: 'operator' },
  });
  const { errors } = form.formState;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.injection.traceability(data.run.id) });
  const assign = useMutation({
    mutationFn: (values: AssignmentFormOutput) => assignRunEmployee(data.run.id, values),
    onSuccess: async () => {
      form.reset();
      toast({ title: t('assigned'), variant: 'success' });
      await invalidate();
    },
    onError: (error) => setAlert(applyApiError(error, form, describe)),
  });
  const end = useMutation({
    mutationFn: (assignmentId: number) => endRunAssignment(data.run.id, assignmentId),
    onSuccess: async () => {
      toast({ title: t('assignmentEnded'), variant: 'success' });
      await invalidate();
    },
    onError: (error) => toast({ title: describe(error), variant: 'error' }),
  });
  const employeeName = (id: number) => {
    const employee = employees.data?.find((item) => item.id === id);
    return employee ? `${employee.code} · ${employee.name}` : `#${id}`;
  };

  return (
    <section className="space-y-2">
      <h3 className="eyebrow">{t('crew')}</h3>
      {data.employees.length === 0 ? (
        <p className="text-sm text-muted">{t('noCrew')}</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line text-sm">
          {data.employees.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate">
                {employeeName(assignment.employee_id)}
              </span>
              <span className="text-muted">{t(`roles.${assignment.role}`)}</span>
              <span className="numeric text-xs text-muted">
                {formatDateTime(assignment.started_at, timeZone, locale)}
                {assignment.ended_at
                  ? ` – ${formatDateTime(assignment.ended_at, timeZone, locale)}`
                  : ` · ${t('ongoing')}`}
              </span>
              {canEdit && assignment.ended_at === null && data.run.ended_at === null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={end.isPending}
                  onClick={() => end.mutate(assignment.id)}
                >
                  {t('endAssignment')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit && data.run.ended_at === null ? (
        <form
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={form.handleSubmit((values) => {
            setAlert(null);
            assign.mutate(values);
          })}
        >
          <FormAlert message={alert} className="basis-full" />
          <Field
            label={t('employee')}
            htmlFor="crew-employee"
            error={errors.employee_id?.message}
            className="min-w-40 flex-1"
          >
            <Select
              id="crew-employee"
              invalid={!!errors.employee_id}
              disabled={employees.isPending}
              {...form.register('employee_id')}
            >
              <option value="">—</option>
              {activeOnly(employees.data).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.code} · {employee.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t('role')}
            htmlFor="crew-role"
            error={errors.role?.message}
            className="w-40"
          >
            <Select id="crew-role" invalid={!!errors.role} {...form.register('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </Select>
          </Field>
          <PendingButton type="submit" size="md" variant="secondary" pending={assign.isPending}>
            {t('assign')}
          </PendingButton>
        </form>
      ) : null}
    </section>
  );
}

interface TraceabilityDialogProps {
  runId: number;
  plantId: number;
  timeZone: string;
  canEdit: boolean;
  machineName: string;
  onClose: () => void;
}

export function TraceabilityDialog({
  runId,
  plantId,
  timeZone,
  canEdit,
  machineName,
  onClose,
}: TraceabilityDialogProps) {
  const t = useTranslations('production');
  const tc = useTranslations('common');
  const locale = useLocale();
  const now = useNow(1000);
  const query = useQuery({
    queryKey: queryKeys.injection.traceability(runId),
    queryFn: () => getTraceability(runId),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t('traceabilityTitle', { id: runId })}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {tc('close')}
        </Button>
      }
    >
      <QueryState
        query={query}
        skeleton={
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        }
      >
        {(data) => {
          const { run } = data;
          const { context } = run;
          return (
            <div className="space-y-4 text-fg">
              <p className="text-xs text-muted">{t('frozen')}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                <Spec label={t('machine')} value={machineName} />
                <Spec
                  label={t('product')}
                  value={`${context.product_code} · ${context.product_name}`}
                />
                <Spec label={t('mold')} value={context.mold_name ?? context.mold_code} />
                <Spec label={t('resin')} value={context.resin_name ?? context.resin_code} />
                <Spec
                  label={t('line')}
                  value={context.line_name ?? context.line_code ?? EMPTY_VALUE}
                />
                <Spec
                  label={t('cavities')}
                  value={`${run.active_cavities} / ${run.nominal_cavities}`}
                />
                <Spec
                  label={t('idealPerPiece', { seconds: '' }).trim()}
                  value={formatDecimal(data.ideal_seconds_per_piece, locale)}
                />
                <Spec
                  label={t('started')}
                  value={formatDateTime(run.started_at, timeZone, locale)}
                />
                <Spec
                  label={t('duration')}
                  value={`${formatDuration(runDuration(run, now))}${run.ended_at ? '' : ` · ${t('ongoing')}`}`}
                />
              </dl>
              <MaterialsSection
                data={data}
                plantId={plantId}
                canEdit={canEdit}
                timeZone={timeZone}
              />
              <CrewSection data={data} plantId={plantId} canEdit={canEdit} timeZone={timeZone} />
            </div>
          );
        }}
      </QueryState>
    </Modal>
  );
}
