'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

interface DayPickerProps {
  value: number[];
  onChange: (value: number[]) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function DayPicker({ value, onChange, invalid, describedBy }: DayPickerProps) {
  const t = useTranslations('days');
  function toggle(day: number) {
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort());
  }
  return (
    <div
      role="group"
      aria-describedby={describedBy}
      className={cn('flex flex-wrap gap-1', invalid && 'rounded-md ring-1 ring-down')}
    >
      {DAYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(day)}
            className={cn(
              'h-9 min-w-11 rounded-md border px-2 text-sm font-medium',
              active
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line bg-panel text-muted hover:bg-panel-2 hover:text-fg',
            )}
          >
            {t(String(day))}
          </button>
        );
      })}
    </div>
  );
}
