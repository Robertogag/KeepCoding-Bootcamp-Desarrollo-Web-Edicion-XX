import { useTranslations } from 'next-intl';
import type { PublicMachine } from '@/lib/api/types';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE } from '@/lib/format';
import { MACHINE_STATES, stateStyles } from '@/lib/machine-state';

// Barra de estados estilo andon: cuenta en color por estado y el total al final.
export function StateCounters({
  machines,
  className,
}: {
  machines: Pick<PublicMachine, 'snapshot'>[] | null;
  className?: string;
}) {
  const t = useTranslations('machines');
  const ts = useTranslations('machineState');
  const tc = useTranslations('common');
  return (
    <ul
      aria-label={t('byState')}
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', className)}
    >
      {MACHINE_STATES.map((state) => {
        const count = machines
          ? machines.filter((machine) => machine.snapshot.state === state).length
          : null;
        return (
          <li
            key={state}
            className={cn(
              'flex items-center gap-2 text-base font-extrabold',
              stateStyles[state].text,
            )}
          >
            <span aria-hidden="true" className="led" />
            <span className="numeric">{count === null ? EMPTY_VALUE : count}</span>
            <span className="text-sm tracking-[0.02em]">{ts(state)}</span>
          </li>
        );
      })}
      <li className="text-sm font-bold text-muted">
        = {machines ? tc('machines', { count: machines.length }) : EMPTY_VALUE}
      </li>
    </ul>
  );
}
