import type { CSSProperties, ReactNode } from 'react';
import type { MachineState } from '@/lib/api/types';
import { cn } from '@/lib/cn';

const SILHOUETTE = '/machines/injection-machine.png';

// Mismo recurso que el tablero de referencia: la imagen de la máquina se tiñe con un filtro por estado.
const tint: Record<MachineState, string> = {
  RUNNING: 'sepia(1) hue-rotate(95deg) saturate(6) brightness(1.35) contrast(1.1)',
  IDLE: 'sepia(1) hue-rotate(25deg) saturate(6) brightness(1.25) contrast(1.05)',
  DOWN: 'sepia(1) hue-rotate(-32deg) saturate(7.5) brightness(0.95) contrast(1.08)',
  OFFLINE: 'grayscale(0.2) brightness(1.05) contrast(1.05)',
};

const glow: Record<MachineState, string> = {
  RUNNING: 'drop-shadow(0 0 6px var(--running))',
  IDLE: 'drop-shadow(0 0 6px var(--idle))',
  DOWN: 'drop-shadow(0 0 8px var(--down))',
  OFFLINE: 'drop-shadow(0 0 3px var(--offline))',
};

interface MachineImageProps {
  state: MachineState;
  vertical?: boolean;
  flip?: boolean;
  className?: string;
  children?: ReactNode;
}

export function MachineImage({
  state,
  vertical = false,
  flip = false,
  className,
  children,
}: MachineImageProps) {
  const image: CSSProperties = {
    backgroundImage: `url(${SILHOUETTE})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    filter: `${tint[state]} ${glow[state]}`,
    opacity: state === 'OFFLINE' ? 0.8 : 1,
  };
  if (!vertical) {
    return (
      <span className={cn('relative block aspect-[800/220] w-full', className)}>
        <span aria-hidden="true" className="absolute inset-0" style={image} />
        {children}
      </span>
    );
  }
  // Vista en planta: la imagen gira 90° dentro de una caja vertical de la misma proporción.
  return (
    <span className={cn('relative block aspect-[220/800] w-full', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1/2 left-1/2 h-[27.5%] w-[363.6%] -translate-x-1/2 -translate-y-1/2',
          flip ? '-rotate-90' : 'rotate-90',
        )}
        style={image}
      />
      {children}
    </span>
  );
}
