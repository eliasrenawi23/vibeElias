/** TanStack Query keys for reports (the list/detail queries arrive in milestone 5). */
export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...reportKeys.lists(), filters] as const,
  detail: (id: string) => [...reportKeys.all, 'detail', id] as const,
};
