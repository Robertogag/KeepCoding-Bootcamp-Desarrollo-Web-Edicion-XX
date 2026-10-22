import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const inputClasses =
  'h-10 w-full rounded-md border border-line bg-panel px-3 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none aria-invalid:border-down disabled:opacity-60';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function describedBy(id: string, error?: string, hint?: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-down">
          {error}
        </p>
      ) : hint ? (
        <div id={`${htmlFor}-hint`} className="text-sm text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, invalid, ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, className)}
      {...props}
    />
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  ref?: Ref<HTMLSelectElement>;
}

export function Select({ className, invalid, ref, children, ...props }: SelectProps) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, className)}
      {...props}
    >
      {children}
    </select>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({ label, className, ref, ...props }: CheckboxProps) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <input ref={ref} type="checkbox" className="size-4 accent-accent" {...props} />
      {label}
    </label>
  );
}
