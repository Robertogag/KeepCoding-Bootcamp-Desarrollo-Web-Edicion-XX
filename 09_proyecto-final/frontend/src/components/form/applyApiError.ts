import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { isApiError } from '@/lib/api/client';

// Si el error trae `field` y el formulario tiene ese campo, va al campo; si no, vuelve como mensaje general.
export function applyApiError<T extends FieldValues>(
  error: unknown,
  form: UseFormReturn<T>,
  describe: (error: unknown) => string,
  aliases: Partial<Record<string, Path<T>>> = {},
): string | null {
  const message = describe(error);
  if (!isApiError(error) || !error.field) return message;
  const field = aliases[error.field] ?? (error.field as Path<T>);
  if (!(field in form.getValues())) return message;
  form.setError(field, { type: 'server', message });
  return null;
}
