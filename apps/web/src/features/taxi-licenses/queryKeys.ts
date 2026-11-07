/** TanStack Query keys for taxi-licenses (the list/detail queries arrive in milestone 3). */
export const taxiLicenseKeys = {
  all: ['taxi-licenses'] as const,
  lists: () => [...taxiLicenseKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...taxiLicenseKeys.lists(), filters] as const,
  detail: (id: string) => [...taxiLicenseKeys.all, 'detail', id] as const,
};
