import type { FineListQuery } from './types';

/** TanStack Query keys for traffic fines. */
export const fineKeys = {
  all: ['fines'] as const,
  lists: () => [...fineKeys.all, 'list'] as const,
  list: (filters: FineListQuery) => [...fineKeys.lists(), filters] as const,
};
