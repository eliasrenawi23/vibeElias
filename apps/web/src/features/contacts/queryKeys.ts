import type { ContactListQuery } from './types';

/** TanStack Query keys for contacts. Invalidate `all` after any contact mutation. */
export const contactKeys = {
  all: ['contacts'] as const,
  lists: () => [...contactKeys.all, 'list'] as const,
  list: (filters: ContactListQuery) => [...contactKeys.lists(), filters] as const,
  detail: (id: string) => [...contactKeys.all, 'detail', id] as const,
  picker: (q: string, tag: string | undefined) => [...contactKeys.all, 'picker', q, tag ?? ''] as const,
};
