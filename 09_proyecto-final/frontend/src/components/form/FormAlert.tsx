import { cn } from '@/lib/cn';

interface FormAlertProps {
  message: string | null | undefined;
  variant?: 'error' | 'success';
  className?: string;
}

export function FormAlert({ message, variant = 'error', className }: FormAlertProps) {
  if (!message) return null;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        variant === 'error'
          ? 'border-down/40 bg-down-soft/60 text-fg'
          : 'border-running/40 bg-running-soft/60 text-fg',
        className,
      )}
    >
      {message}
    </div>
  );
}
