import type { MachineState } from '@/lib/api/types';

export const MACHINE_STATES: readonly MachineState[] = ['RUNNING', 'IDLE', 'DOWN', 'OFFLINE'];

export const stateStyles: Record<
  MachineState,
  { dot: string; text: string; soft: string; border: string; bar: string; glow: string }
> = {
  RUNNING: {
    dot: 'bg-running',
    text: 'text-running',
    soft: 'bg-running-soft',
    border: 'border-running',
    bar: 'bg-running',
    glow: 'glow-running',
  },
  IDLE: {
    dot: 'bg-idle',
    text: 'text-idle',
    soft: 'bg-idle-soft',
    border: 'border-idle',
    bar: 'bg-idle',
    glow: 'glow-idle',
  },
  DOWN: {
    dot: 'bg-down',
    text: 'text-down',
    soft: 'bg-down-soft',
    border: 'border-down',
    bar: 'bg-down',
    glow: 'glow-down',
  },
  OFFLINE: {
    dot: 'bg-offline',
    text: 'text-offline',
    soft: 'bg-offline-soft',
    border: 'border-offline',
    bar: 'bg-offline',
    glow: 'glow-offline',
  },
};

export function isMachineState(value: string | null | undefined): value is MachineState {
  return MACHINE_STATES.includes(value as MachineState);
}
