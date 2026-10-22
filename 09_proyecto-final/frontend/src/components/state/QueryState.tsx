'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { useErrorMessage } from './errorMessage';

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({ query, skeleton, isEmpty, empty, children }: QueryStateProps<T>) {
  const describe = useErrorMessage();

  if (query.isPending) return <>{skeleton}</>;
  if (query.isError) {
    return <ErrorState message={describe(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
