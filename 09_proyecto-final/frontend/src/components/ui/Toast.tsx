'use client';

import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'error';
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

type PushToast = (toast: ToastInput) => void;

const ToastContext = createContext<PushToast | null>(null);

const accents: Record<NonNullable<ToastInput['variant']>, string> = {
  info: 'border-l-accent',
  success: 'border-l-running',
  error: 'border-l-down',
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const t = useTranslations('common');
  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-md border border-line border-l-4 bg-panel p-3 text-sm shadow-lg',
        accents[item.variant ?? 'info'],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.title}</p>
          {item.description ? <p className="mt-0.5 text-muted">{item.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('close')}
          className="-m-1 rounded p-1 text-muted hover:text-fg"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {item.action ? (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              item.action?.onClick();
              onDismiss();
            }}
          >
            {item.action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback<PushToast>(
    (toast) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.durationMs ?? 6000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 md:inset-x-auto md:right-4 md:bottom-4"
      >
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  const push = useContext(ToastContext);
  if (!push) throw new Error('ToastProvider is missing');
  return push;
}
