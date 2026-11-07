import type { ChargeKind, LedgerPaymentMethod } from '@renawi/shared';
import { asItems } from '../../shared/lib/collections';
import { http } from '../../shared/lib/http';
import type { DriverBalanceRow, DriverLedger, LedgerEntry, LedgerList, LedgerQuery } from './types';

/** Largest page the API serves: statements are shown in full. */
const STATEMENT_PAGE_SIZE = 200;

/** `GET /api/drivers/:id/ledger?from&to&type&includeVoided` */
export function fetchDriverLedger(
  driverId: string,
  query: Omit<LedgerQuery, 'driverId' | 'contractId'>,
  signal?: AbortSignal,
): Promise<DriverLedger> {
  return http.get<DriverLedger>(`/drivers/${encodeURIComponent(driverId)}/ledger`, {
    query: { ...query, includeVoided: query.includeVoided ? true : undefined },
    signal,
  });
}

/** `GET /api/ledger?driverId&contractId&from&to&type&includeVoided` (one page of up to 200). */
export async function fetchLedger(query: LedgerQuery, signal?: AbortSignal): Promise<LedgerList> {
  const res = await http.get<LedgerList | LedgerEntry[]>('/ledger', {
    query: {
      ...query,
      includeVoided: query.includeVoided ? true : undefined,
      pageSize: STATEMENT_PAGE_SIZE,
    },
    signal,
  });
  return Array.isArray(res) ? { items: res } : { ...res, items: asItems(res) };
}

export interface BalancesQuery {
  /** Only drivers with an open charge past its due date. */
  overdueOnly?: boolean;
  /** Only drivers who owe money (balance > 0). */
  debtorsOnly?: boolean;
}

/** `GET /api/ledger/balances?overdueOnly&debtorsOnly` (one page of up to 200 drivers). */
export async function fetchBalances(
  query: BalancesQuery = {},
  signal?: AbortSignal,
): Promise<DriverBalanceRow[]> {
  const res = await http.get<{ items: DriverBalanceRow[] } | DriverBalanceRow[]>(
    '/ledger/balances',
    {
      query: {
        overdueOnly: query.overdueOnly || undefined,
        debtorsOnly: query.debtorsOnly || undefined,
        pageSize: STATEMENT_PAGE_SIZE,
      },
      signal,
    },
  );
  return asItems(res);
}

/** Receivables KPI: the sum of the positive driver balances. */
export async function fetchReceivables(signal?: AbortSignal): Promise<number> {
  const rows = await fetchBalances({ debtorsOnly: true }, signal);
  const agorot = rows.reduce(
    (sum, r) => sum + (Number(r.balance) > 0 ? Math.round(Number(r.balance) * 100) : 0),
    0,
  );
  return agorot / 100;
}

export interface PaymentBody {
  driverId: string;
  contractId?: string | null;
  amount: number;
  date: string;
  method: LedgerPaymentMethod;
  reference?: string | null;
  notes?: string | null;
}

/** `POST /api/ledger/payments` */
export function recordPayment(body: PaymentBody): Promise<LedgerEntry> {
  return http.post<LedgerEntry>('/ledger/payments', body);
}

export interface ChargeBody {
  driverId: string;
  contractId?: string | null;
  chargeKind: Exclude<ChargeKind, 'RENT'>;
  amount: number;
  date: string;
  dueDate?: string | null;
  description?: string | null;
  vehicleId?: string | null;
}

/** `POST /api/ledger/charges` (RENT charges come from billing, not from here). */
export function addCharge(body: ChargeBody): Promise<LedgerEntry> {
  return http.post<LedgerEntry>('/ledger/charges', body);
}

export interface CreditBody {
  driverId: string;
  contractId?: string | null;
  amount: number;
  date: string;
  description?: string | null;
}

/** `POST /api/ledger/credits` */
export function addCredit(body: CreditBody): Promise<LedgerEntry> {
  return http.post<LedgerEntry>('/ledger/credits', body);
}

/** `POST /api/ledger/:id/void { reason }` (409 `errors.alreadyVoided`). */
export function voidEntry(id: string, reason: string): Promise<LedgerEntry> {
  return http.post<LedgerEntry>(`/ledger/${encodeURIComponent(id)}/void`, { reason });
}
