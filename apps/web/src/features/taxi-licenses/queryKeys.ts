import type { TaxiLicenseListQuery } from './types';

/** TanStack Query keys for taxi licences. */
export const taxiLicenseKeys = {
  all: ['taxi-licenses'] as const,
  lists: () => [...taxiLicenseKeys.all, 'list'] as const,
  list: (filters: TaxiLicenseListQuery) => [...taxiLicenseKeys.lists(), filters] as const,
  /** ACTIVE licences offered by the lease wizard / pickers. */
  available: () => [...taxiLicenseKeys.all, 'available'] as const,
  detail: (id: string) => [...taxiLicenseKeys.all, 'detail', id] as const,
};
