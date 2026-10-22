'use client';

import { Button, type ButtonProps } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface PendingButtonProps extends ButtonProps {
  pending: boolean;
}

export function PendingButton({ pending, disabled, children, ...props }: PendingButtonProps) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
