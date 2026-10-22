import { useQuery } from '@tanstack/react-query';
import { checkAvailability } from '@/lib/api/auth';
import { queryKeys } from '@/lib/query/keys';
import { useDebouncedValue } from './useDebouncedValue';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken';

interface Options {
  field: 'username' | 'email';
  value: string;
  valid: boolean;
  skip?: string;
}

// Consulta /auth/availability con retardo; no pregunta por valores inválidos ni por el valor actual del usuario.
export function useAvailability({ field, value, valid, skip }: Options): AvailabilityStatus {
  const debounced = useDebouncedValue(value.trim(), 400);
  const enabled = valid && debounced.length > 0 && debounced !== skip;
  const query = useQuery({
    queryKey: queryKeys.availability(field, debounced),
    queryFn: () => checkAvailability({ [field]: debounced }),
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  if (!enabled || debounced !== value.trim()) return 'idle';
  if (query.isPending) return 'checking';
  if (!query.data) return 'idle';
  const available =
    field === 'username' ? query.data.username_available : query.data.email_available;
  return available ? 'available' : 'taken';
}
