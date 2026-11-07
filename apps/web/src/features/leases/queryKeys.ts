import type { LedgerQuery } from '../ledger/types';
import type { LeaseListQuery } from './types';

/**
 * TanStack Query keys for leases. The contract-scoped statement hangs under `detail(id)`, so
 * invalidating the detail refreshes the header, the tabs and the statement.
 */
export const leaseKeys = {
  all: ['leases'] as const,
  lists: () => [...leaseKeys.all, 'list'] as const,
  list: (filters: LeaseListQuery) => [...leaseKeys.lists(), filters] as const,
  count: (status: string) => [...leaseKeys.all, 'count', status] as const,
  detail: (id: string) => [...leaseKeys.all, 'detail', id] as const,
  ledger: (id: string, filters: Omit<LedgerQuery, 'driverId' | 'contractId'>) =>
    [...leaseKeys.detail(id), 'ledger', filters] as const,
};
