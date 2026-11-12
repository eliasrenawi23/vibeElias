import type { DealSummary, Paginated } from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type {
  DealCreateBody,
  DealDetail,
  DealListItem,
  DealListQuery,
  DealPaymentBody,
  DealTransferBody,
  DealUpdateBody,
} from './types';

const dealPath = (id: string) => `/deals/${encodeURIComponent(id)}`;

/** `GET /api/deals?type&status&from&to&vehicleId&counterpartyId&q&page&pageSize&sort&order` */
export function fetchDeals(
  query: DealListQuery,
  signal?: AbortSignal,
): Promise<Paginated<DealListItem>> {
  return http.get<Paginated<DealListItem>>('/deals', { query: { ...query }, signal });
}

/** List filters a status summary honours: everything except status, paging and sorting. */
export type DealSummaryQuery = Omit<DealListQuery, 'status' | 'page' | 'pageSize' | 'sort' | 'order'>;

/** `GET /api/deals/summary?type&from&to&vehicleId&counterpartyId&q`: count per status. */
export function fetchDealSummary(
  query: DealSummaryQuery,
  signal?: AbortSignal,
): Promise<DealSummary> {
  return http.get<DealSummary>('/deals/summary', { query: { ...query }, signal });
}

export function fetchDeal(id: string, signal?: AbortSignal): Promise<DealDetail> {
  return http.get<DealDetail>(dealPath(id), { signal });
}

/**
 * `POST /api/deals` (409 `errors.cycleOpen` / `noOpenCycle` / `vehicleLeased` / `dealPending`;
 * a known plate on an inline car: `errors[vehicle.create.plateNo | tradeIn.vehicle.create.plateNo]
 * = validation.duplicate`).
 */
export function createDeal(body: DealCreateBody): Promise<DealDetail> {
  return http.post<DealDetail>('/deals', body);
}

/** `PATCH /api/deals/:id` (409 `errors.dealNotEditable`). */
export function updateDeal(id: string, body: DealUpdateBody): Promise<DealDetail> {
  return http.patch<DealDetail>(dealPath(id), body);
}

/** `POST /api/deals/:id/disclosure`: the buyer countersigned the disclosure form. */
export function recordDisclosure(id: string, body: { signedAt: string }): Promise<DealDetail> {
  return http.post<DealDetail>(`${dealPath(id)}/disclosure`, body);
}

/** `POST /api/deals/:id/complete` (409 `errors.disclosureRequired` / `errors.vehicleLeased`). */
export function completeDeal(id: string, body: { date?: string }): Promise<DealDetail> {
  return http.post<DealDetail>(`${dealPath(id)}/complete`, body);
}

/** `POST /api/deals/:id/cancel` (409 `errors.dealNotCancellable` / `errors.dealHasPayments`). */
export function cancelDeal(id: string, body: { reason?: string }): Promise<DealDetail> {
  return http.post<DealDetail>(`${dealPath(id)}/cancel`, body);
}

/** `POST /api/deals/:id/payments` */
export function addDealPayment(id: string, body: DealPaymentBody): Promise<DealDetail> {
  return http.post<DealDetail>(`${dealPath(id)}/payments`, body);
}

/**
 * `DELETE /api/deal-payments/:id` (409 `errors.systemPayment` for TRADE_IN rows). Resolves with the
 * deal when the API sends it back (otherwise the caller refetches).
 */
export async function deleteDealPayment(paymentId: string): Promise<DealDetail | null> {
  const res = await http.delete<DealDetail | undefined>(
    `/deal-payments/${encodeURIComponent(paymentId)}`,
  );
  return res && typeof res === 'object' && 'dealNo' in res ? res : null;
}

/** `PATCH /api/deals/:id/transfer`: checklist items, status and the transfer date. */
export function updateDealTransfer(id: string, body: DealTransferBody): Promise<DealDetail> {
  return http.patch<DealDetail>(`${dealPath(id)}/transfer`, body);
}
