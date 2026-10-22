import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-accent to-[#1d4ed8] text-accent-fg shadow-[0_6px_16px_rgba(37,99,235,0.35)] hover:brightness-110',
  secondary:
    'border border-line-strong bg-panel-2 text-fg hover:border-accent-text/60 hover:text-accent-text',
  ghost: 'text-muted hover:bg-panel-2 hover:text-fg',
  danger: 'bg-gradient-to-br from-down to-[#b91c1c] text-white hover:brightness-110',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs font-bold tracking-[0.04em]',
  md: 'h-10 px-4 text-sm font-bold tracking-[0.02em]',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md whitespace-nowrap transition-[color,background-color,border-color,filter] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100',
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export const iconButtonClasses =
  'inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-fg disabled:opacity-60';
