import type { DealListQuery } from './types';

/** TanStack Query keys for deals. Invalidate `all` after any deal mutation. */
export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (filters: DealListQuery) => [...dealKeys.lists(), filters] as const,
  detail: (id: string) => [...dealKeys.all, 'detail', id] as const,
};
