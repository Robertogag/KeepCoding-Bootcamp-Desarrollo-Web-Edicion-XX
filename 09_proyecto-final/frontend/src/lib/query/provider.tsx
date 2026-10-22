'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { isApiError } from '@/lib/api/client';
import { isServer } from '@/lib/runtime';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status > 0 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export function resetQueryClient() {
  browserQueryClient?.clear();
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
