/** TanStack Query keys for leases (the list/detail queries arrive in milestone 3). */
export const leaseKeys = {
  all: ['leases'] as const,
  lists: () => [...leaseKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...leaseKeys.lists(), filters] as const,
  detail: (id: string) => [...leaseKeys.all, 'detail', id] as const,
};
