import type { LedgerQuery } from './types';

/** TanStack Query keys for ledger lists that are not under a driver / lease detail. */
export const ledgerKeys = {
  all: ['ledger'] as const,
  list: (query: LedgerQuery) => [...ledgerKeys.all, 'list', query] as const,
  balances: () => [...ledgerKeys.all, 'balances'] as const,
  receivables: () => [...ledgerKeys.all, 'receivables'] as const,
};
