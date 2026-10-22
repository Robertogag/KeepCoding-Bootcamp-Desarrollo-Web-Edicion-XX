import { MachineCard } from '@/components/machines/MachineCard';
import type { PublicMachine } from '@/lib/api/types';

interface PublicMachineCardProps {
  machine: PublicMachine;
  plantSlug: string;
  now: number;
}

export function PublicMachineCard({ machine, plantSlug, now }: PublicMachineCardProps) {
  return <MachineCard machine={machine} href={`/plants/${plantSlug}/${machine.slug}`} now={now} />;
}
