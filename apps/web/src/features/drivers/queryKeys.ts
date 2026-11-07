/** TanStack Query keys for drivers (the list/detail queries arrive in milestone 3). */
export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...driverKeys.lists(), filters] as const,
  detail: (id: string) => [...driverKeys.all, 'detail', id] as const,
};
