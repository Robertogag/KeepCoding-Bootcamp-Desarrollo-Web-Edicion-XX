'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { IconAlert, IconRefresh } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, message, onRetry, action, className }: ErrorStateProps) {
  const t = useTranslations('state');
  return (
    <div
      role="alert"
      className={cn('rounded-lg border border-down/40 bg-down-soft/60 p-5 text-fg', className)}
    >
      <div className="flex items-start gap-3">
        <IconAlert className="mt-0.5 size-5 shrink-0 text-down" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title ?? t('errorTitle')}</p>
          {message ? <p className="mt-1 text-sm text-muted">{message}</p> : null}
          {action || onRetry ? (
            <div className="mt-3">
              {action ?? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  <IconRefresh className="size-4" />
                  {t('retry')}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
