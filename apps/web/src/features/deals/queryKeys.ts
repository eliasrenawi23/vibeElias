/** TanStack Query keys for deals (the list/detail queries arrive in milestone 4). */
export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...dealKeys.lists(), filters] as const,
  detail: (id: string) => [...dealKeys.all, 'detail', id] as const,
};
