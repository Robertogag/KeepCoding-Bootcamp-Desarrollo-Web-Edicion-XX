import { useTranslations } from 'next-intl';
import type { MachineState } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { stateStyles } from '@/lib/machine-state';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'plain' | 'label';

const textSizes: Record<Size, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
const labelSizes: Record<Size, string> = { sm: 'text-[11px]', md: 'text-xs', lg: 'text-sm' };
const dotSizes: Record<Size, string> = { sm: 'size-2', md: 'size-2.5', lg: 'size-3' };

export function StateIndicator({
  state,
  size = 'md',
  variant = 'plain',
  className,
}: {
  state: MachineState;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const t = useTranslations('machineState');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2',
        variant === 'label'
          ? cn('font-semibold tracking-[0.08em] uppercase', labelSizes[size])
          : cn('font-medium', textSizes[size]),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('inline-block shrink-0 rounded-full', dotSizes[size], stateStyles[state].dot)}
      />
      {t(state)}
    </span>
  );
}
