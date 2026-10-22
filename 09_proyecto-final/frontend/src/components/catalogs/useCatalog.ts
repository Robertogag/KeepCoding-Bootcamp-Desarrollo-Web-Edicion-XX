'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCatalogItem,
  listAllCatalog,
  updateCatalogItem,
  type CatalogMap,
  type CatalogResource,
} from '@/lib/api/injection';
import { queryKeys } from '@/lib/query/keys';

export function useCatalog<R extends CatalogResource>(plantId: number, resource: R) {
  return useQuery({
    queryKey: queryKeys.injection.catalog(plantId, resource),
    queryFn: () => listAllCatalog(plantId, resource),
    staleTime: 60_000,
  });
}

export function useCatalogSave<R extends CatalogResource>(
  plantId: number,
  resource: R,
  itemId: number | undefined,
  options: { onSuccess: () => void; onError: (error: unknown) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CatalogMap[R]['input']) =>
      itemId === undefined
        ? createCatalogItem(plantId, resource, input)
        : updateCatalogItem(plantId, resource, itemId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.injection.catalog(plantId, resource),
      });
      options.onSuccess();
    },
    onError: options.onError,
  });
}

interface Named {
  id: number;
  code: string;
  name: string;
}

// Las recetas y los lotes solo traen ids: el nombre se resuelve con el catálogo en caché.
export function labelOf(
  items: Named[] | undefined,
  id: number | null | undefined,
  fallback: string,
): string {
  if (id === null || id === undefined) return fallback;
  const item = items?.find((entry) => entry.id === id);
  return item ? `${item.code} · ${item.name}` : fallback;
}

export function activeOnly<T extends { is_active: boolean }>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => item.is_active);
}
