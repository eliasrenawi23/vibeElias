import type {
  BillingPeriod,
  DepositAction,
  DepositKind,
  HandoverChecklist,
  LeaseEndReason,
  LeaseSummary,
  LeaseType,
  LedgerPaymentMethod,
  Paginated,
  Responsibilities,
  ReturnChecklist,
} from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { LeaseDetail, LeaseListItem, LeaseListQuery } from './types';

const leasePath = (id: string) => `/leases/${encodeURIComponent(id)}`;

/** `GET /api/leases?status&driverId&taxiLicenseId&vehicleId&q&page&pageSize&sort&order` */
export function fetchLeases(
  query: LeaseListQuery,
  signal?: AbortSignal,
): Promise<Paginated<LeaseListItem>> {
  return http.get<Paginated<LeaseListItem>>('/leases', { query: { ...query }, signal });
}

/** List filters a status summary honours: everything except status, paging and sorting. */
export type LeaseSummaryQuery = Omit<LeaseListQuery, 'status' | 'page' | 'pageSize' | 'sort' | 'order'>;

/** `GET /api/leases/summary?q&driverId&taxiLicenseId&vehicleId`: count per status. */
export function fetchLeaseSummary(
  query: LeaseSummaryQuery,
  signal?: AbortSignal,
): Promise<LeaseSummary> {
  return http.get<LeaseSummary>('/leases/summary', { query: { ...query }, signal });
}

/** Number of contracts with a status (`pageSize=1`, reads `total`). */
export async function countLeases(status: string, signal?: AbortSignal): Promise<number> {
  const res = await fetchLeases({ status, pageSize: 1 }, signal);
  return res.total;
}

export function fetchLease(id: string, signal?: AbortSignal): Promise<LeaseDetail> {
  return http.get<LeaseDetail>(leasePath(id), { signal });
}

/** Contract terms shared by create and (draft) edit. */
export interface LeaseTermsBody {
  startDate: string;
  endDate: string;
  paymentDay: number;
  rentIncludesVat: boolean;
  earlyExitPenaltyMonths: number;
  depositAmount: number;
  depositKind: DepositKind;
  responsibilities: Responsibilities;
  terms: string | null;
  notes?: string | null;
}

/** `POST /api/leases`: a DRAFT contract with its first segment. */
export interface LeaseCreateBody extends LeaseTermsBody {
  driverId: string;
  type: LeaseType;
  billingPeriod: BillingPeriod;
  taxiLicenseId: string;
  vehicleId: string | null;
  monthlyRent: number;
  handoverChecklist?: HandoverChecklist | null;
}

/**
 * `POST /api/leases` (409 `errors.licenseInUse` / `vehicleInUse` / `driverInactive` /
 * `licenseNotActive` / `vehicleNotAvailable` / `taxiAgeBlocked`; 400 `validation.endAfterStart`).
 */
export function createLease(body: LeaseCreateBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>('/leases', body);
}

/** `PATCH /api/leases/:id` (DRAFT: anything; ACTIVE: endDate, paymentDay, terms, responsibilities, notes). */
export type LeaseUpdateBody = Partial<
  LeaseTermsBody & { taxiLicenseId: string; vehicleId: string | null; monthlyRent: number }
>;

export function updateLease(id: string, body: LeaseUpdateBody): Promise<LeaseDetail> {
  return http.patch<LeaseDetail>(leasePath(id), body);
}

/** `DELETE /api/leases/:id` (DRAFT only). */
export function deleteLease(id: string): Promise<void> {
  return http.delete<void>(leasePath(id));
}

export interface LeaseActivateBody {
  signedAt?: string | null;
  deposit?: {
    amount: number;
    method: LedgerPaymentMethod;
    reference?: string | null;
    date?: string;
  };
}

/** `POST /api/leases/:id/activate`: first rent charges and the deposit receipt. */
export function activateLease(id: string, body: LeaseActivateBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>(`${leasePath(id)}/activate`, body);
}

export interface LeaseSegmentBody {
  startDate: string;
  taxiLicenseId?: string;
  vehicleId?: string | null;
  monthlyRent?: number;
  reason: string;
}

/** `POST /api/leases/:id/segments`: car swap and / or rent change from `startDate`. */
export function addSegment(id: string, body: LeaseSegmentBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>(`${leasePath(id)}/segments`, body);
}

/** Deposit handling when a contract ends. */
export type EndDepositAction = 'HOLD' | 'RETURN' | 'APPLY';

export interface LeaseEndBody {
  actualEndDate: string;
  reason: Exclude<LeaseEndReason, 'RENEWED'>;
  applyPenalty?: boolean;
  depositAction?: EndDepositAction;
  depositMethod?: LedgerPaymentMethod | null;
  note?: string | null;
  returnChecklist?: ReturnChecklist | null;
}

/** `POST /api/leases/:id/end` */
export function endLease(id: string, body: LeaseEndBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>(`${leasePath(id)}/end`, body);
}

export interface LeaseRenewBody {
  startDate?: string;
  endDate: string;
  monthlyRent?: number;
  paymentDay?: number;
  terms?: string | null;
  responsibilities?: Responsibilities;
  earlyExitPenaltyMonths?: number;
}

/** `POST /api/leases/:id/renew`: returns the NEW contract. */
export function renewLease(id: string, body: LeaseRenewBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>(`${leasePath(id)}/renew`, body);
}

export interface LeaseDepositBody {
  action: DepositAction;
  amount: number;
  method?: LedgerPaymentMethod | null;
  reference?: string | null;
  date?: string;
  note?: string | null;
}

/** `POST /api/leases/:id/deposit` (409 `errors.depositInsufficient`). */
export function depositAction(id: string, body: LeaseDepositBody): Promise<LeaseDetail> {
  return http.post<LeaseDetail>(`${leasePath(id)}/deposit`, body);
}

/** `PATCH /api/leases/:id/checklists` */
export function updateChecklists(
  id: string,
  body: { handoverChecklist?: HandoverChecklist; returnChecklist?: ReturnChecklist },
): Promise<LeaseDetail> {
  return http.patch<LeaseDetail>(`${leasePath(id)}/checklists`, body);
}
