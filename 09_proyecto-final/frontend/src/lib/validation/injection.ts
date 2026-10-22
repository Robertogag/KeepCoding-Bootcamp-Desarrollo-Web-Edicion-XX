import { z } from 'zod';
import type { Translate } from './auth';

const CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const VARIABLE_CODE = /^[a-z][a-z0-9_]{0,39}$/;

const number = (t: Translate, message: string) =>
  z.coerce.number<number | string>({ error: t(message) });

function id(t: Translate) {
  return z.coerce
    .number<number | string>({ error: t('select') })
    .int()
    .positive(t('select'));
}

export function catalogBase(t: Translate) {
  return z.object({
    code: z.string().trim().regex(CODE, t('code')),
    name: z.string().trim().min(1, t('catalogName')).max(120, t('catalogName')),
    is_active: z.boolean(),
  });
}

export function lineSchema(t: Translate) {
  return catalogBase(t);
}

export function productSchema(t: Translate) {
  return catalogBase(t).extend({
    part_weight_g: number(t, 'partWeight').gt(0, t('partWeight')).max(100_000, t('partWeight')),
    description: z.string().trim().max(500, t('description')),
  });
}

export function moldSchema(t: Translate) {
  return catalogBase(t).extend({
    nominal_cavities: number(t, 'cavities')
      .int(t('cavities'))
      .min(1, t('cavities'))
      .max(1024, t('cavities')),
  });
}

export function resinSchema(t: Translate) {
  return catalogBase(t).extend({
    polymer: z.string().trim().min(1, t('shortText')).max(40, t('shortText')),
    grade: z.string().trim().min(1, t('shortText')).max(40, t('shortText')),
    manufacturer: z.string().trim().max(80, t('manufacturer')),
  });
}

export function employeeSchema(t: Translate) {
  return catalogBase(t).extend({
    user_id: z.union([z.literal(''), id(t)]),
  });
}

export function recipeSchema(t: Translate, nominalCavities: (moldId: number) => number | null) {
  return catalogBase(t)
    .extend({
      product_id: id(t),
      mold_id: id(t),
      resin_id: id(t),
      ideal_cycle_s: number(t, 'idealCycle').min(0.1, t('idealCycle')).max(3600, t('idealCycle')),
      active_cavities: number(t, 'activeCavities')
        .int(t('activeCavities'))
        .min(1, t('activeCavities'))
        .max(1024, t('activeCavities')),
    })
    .superRefine((value, context) => {
      const nominal = nominalCavities(value.mold_id);
      if (nominal !== null && value.active_cavities > nominal) {
        context.addIssue({
          code: 'custom',
          path: ['active_cavities'],
          message: t('activeCavities'),
        });
      }
    });
}

export function lotSchema(t: Translate) {
  return z.object({
    resin_id: id(t),
    lot_code: z.string().trim().regex(CODE, t('code')),
    received_kg: number(t, 'kg').gt(0, t('kg')).max(1_000_000, t('kg')),
  });
}

export function orderSchema(t: Translate) {
  return z.object({
    code: z.string().trim().regex(CODE, t('code')),
    recipe_id: id(t),
    target_pieces: number(t, 'target')
      .int(t('target'))
      .min(1, t('target'))
      .max(100_000_000, t('target')),
  });
}

export function runStartSchema(t: Translate) {
  return z.object({
    machine_id: id(t),
    order_id: id(t),
    active_cavities: z.union([
      z.literal(''),
      number(t, 'cavities').int(t('cavities')).min(1, t('cavities')).max(1024, t('cavities')),
    ]),
  });
}

export function materialSchema(t: Translate) {
  return z.object({
    resin_lot_id: id(t),
    consumed_kg: number(t, 'kg').gt(0, t('kg')).max(1_000_000, t('kg')),
  });
}

export function assignmentSchema(t: Translate) {
  return z.object({
    employee_id: id(t),
    role: z.enum(['operator', 'technician', 'quality', 'supervisor'], t('select')),
  });
}

export function downtimeSchema(t: Translate) {
  return z.object({
    line_id: id(t),
    reason_code: z.string().min(1, t('reason')),
    planned: z.boolean(),
    comment: z.string().trim().max(500, t('comment')),
  });
}

export function variableSchema(t: Translate) {
  return z.object({
    code: z.string().trim().regex(VARIABLE_CODE, t('variableCode')),
    name: z.string().trim().min(1, t('variableName')).max(80, t('variableName')),
    unit: z.string().trim().max(16, t('unit')),
    address: number(t, 'address').int(t('address')).min(9, t('address')).max(65_535, t('address')),
    data_type: z.enum(['uint16', 'int16', 'uint32', 'int32', 'float32'], t('select')),
    word_order: z.enum(['big', 'little'], t('select')),
    byte_order: z.enum(['big', 'little'], t('select')),
    scale: number(t, 'number'),
    offset: number(t, 'number'),
    is_active: z.boolean(),
  });
}

export type ProductFormInput = z.input<ReturnType<typeof productSchema>>;
export type ProductFormOutput = z.output<ReturnType<typeof productSchema>>;
export type MoldFormInput = z.input<ReturnType<typeof moldSchema>>;
export type MoldFormOutput = z.output<ReturnType<typeof moldSchema>>;
export type ResinFormInput = z.input<ReturnType<typeof resinSchema>>;
export type ResinFormOutput = z.output<ReturnType<typeof resinSchema>>;
export type EmployeeFormInput = z.input<ReturnType<typeof employeeSchema>>;
export type EmployeeFormOutput = z.output<ReturnType<typeof employeeSchema>>;
export type RecipeFormInput = z.input<ReturnType<typeof recipeSchema>>;
export type RecipeFormOutput = z.output<ReturnType<typeof recipeSchema>>;
export type LineFormInput = z.input<ReturnType<typeof lineSchema>>;
export type LineFormOutput = z.output<ReturnType<typeof lineSchema>>;
export type LotFormInput = z.input<ReturnType<typeof lotSchema>>;
export type LotFormOutput = z.output<ReturnType<typeof lotSchema>>;
export type OrderFormInput = z.input<ReturnType<typeof orderSchema>>;
export type OrderFormOutput = z.output<ReturnType<typeof orderSchema>>;
export type RunStartFormInput = z.input<ReturnType<typeof runStartSchema>>;
export type RunStartFormOutput = z.output<ReturnType<typeof runStartSchema>>;
export type MaterialFormInput = z.input<ReturnType<typeof materialSchema>>;
export type MaterialFormOutput = z.output<ReturnType<typeof materialSchema>>;
export type AssignmentFormInput = z.input<ReturnType<typeof assignmentSchema>>;
export type AssignmentFormOutput = z.output<ReturnType<typeof assignmentSchema>>;
export type DowntimeFormInput = z.input<ReturnType<typeof downtimeSchema>>;
export type DowntimeFormOutput = z.output<ReturnType<typeof downtimeSchema>>;
export type VariableFormInput = z.input<ReturnType<typeof variableSchema>>;
export type VariableFormOutput = z.output<ReturnType<typeof variableSchema>>;
