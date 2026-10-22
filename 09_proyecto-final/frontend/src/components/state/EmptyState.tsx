import type { ReactNode } from 'react';
import { IconInbox } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  text?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, text, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-line bg-panel px-6 py-12 text-center',
        className,
      )}
    >
      <div className="text-muted">{icon ?? <IconInbox className="size-8" />}</div>
      <p className="mt-3 font-medium">{title}</p>
      {text ? <p className="mt-1 max-w-sm text-sm text-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
