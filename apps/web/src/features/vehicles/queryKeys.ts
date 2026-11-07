import type { ExpenseListQuery, VehicleListQuery } from './types';

/**
 * TanStack Query keys for vehicles. Everything shown on the vehicle page hangs under
 * `detail(id)`, so invalidating it refreshes the header, the tabs and the expense list.
 */
export const vehicleKeys = {
  all: ['vehicles'] as const,
  lists: () => [...vehicleKeys.all, 'list'] as const,
  list: (filters: VehicleListQuery) => [...vehicleKeys.lists(), filters] as const,
  count: (status: string) => [...vehicleKeys.all, 'count', status] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
  expenses: (id: string, filters: ExpenseListQuery) =>
    [...vehicleKeys.detail(id), 'expenses', filters] as const,
};

/** Business-scope insurance policies (TRADE / LOT). */
export const insuranceKeys = {
  all: ['insurance'] as const,
  business: (activeOnly: boolean) => [...insuranceKeys.all, 'business', { activeOnly }] as const,
};
