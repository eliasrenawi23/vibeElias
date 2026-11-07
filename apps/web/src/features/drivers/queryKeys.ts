import type { LedgerQuery } from '../ledger/types';
import type { DriverListQuery } from './types';

/**
 * TanStack Query keys for drivers. The driver page's ledger hangs under `detail(id)`, so
 * invalidating the detail refreshes the header, the tabs and the statement.
 */
export const driverKeys = {
  all: ['drivers'] as const,
  lists: () => [...driverKeys.all, 'list'] as const,
  list: (filters: DriverListQuery) => [...driverKeys.lists(), filters] as const,
  picker: (q: string) => [...driverKeys.all, 'picker', q] as const,
  detail: (id: string) => [...driverKeys.all, 'detail', id] as const,
  ledger: (id: string, filters: Omit<LedgerQuery, 'driverId' | 'contractId'>) =>
    [...driverKeys.detail(id), 'ledger', filters] as const,
};
