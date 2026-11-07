/** TanStack Query keys for fines (the list/detail queries arrive in milestone 3). */
export const fineKeys = {
  all: ['fines'] as const,
  lists: () => [...fineKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...fineKeys.lists(), filters] as const,
  detail: (id: string) => [...fineKeys.all, 'detail', id] as const,
};
