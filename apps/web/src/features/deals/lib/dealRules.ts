import {
  addWorkingDays,
  computeCommission,
  diffDays,
  round2,
  TRANSFER_CHECKLIST_KEYS,
  TRANSFER_DUE_WORKING_DAYS,
  transferChecklistKeysFor,
  vatFromGross,
  vatOnMargin,
  type CommissionMode,
  type CommissionResult,
  type DealStatus,
  type DealType,
  type Direction,
  type TransferChecklistKey,
  type VehicleStatus,
} from '@renawi/shared';
import type { TKey } from '../../../shared/lib/i18n';
import type { DealDetail, DealListItem, DealPayment, TransferChecklistValue } from '../types';

/** `/deals/:id` link. */
export function dealPath(id: string): string {
  return `/deals/${encodeURIComponent(id)}`;
}

/** `/deals/new?type=` link, optionally for a car (`vehicleId`). */
export function newDealPath(type: DealType, vehicleId?: string | null): string {
  const params = new URLSearchParams({ type });
  if (vehicleId) params.set('vehicleId', vehicleId);
  return `/deals/new?${params.toString()}`;
}

/** AntD preset colour per deal alert code. */
export const DEAL_ALERT_COLORS: Readonly<Record<string, string>> = {
  disclosureMissing: 'warning',
  transferDue: 'processing',
  transferOverdue: 'error',
  unpaid: 'warning',
};

/** AntD preset colour per deal type. */
export const DEAL_TYPE_COLORS: Readonly<Record<DealType, string>> = {
  PURCHASE: 'blue',
  SALE: 'green',
  CONSIGNMENT_SALE: 'purple',
};

/** Label of the counterparty for a deal type (seller of a purchase, buyer of a sale). */
export function counterpartyLabelKey(type: DealType): TKey {
  return type === 'PURCHASE' ? 'deals.fields.seller' : 'deals.fields.buyer';
}

/** Draft and pending deals can still be edited, completed or cancelled. */
export function isOpenDeal(status: DealStatus): boolean {
  return status === 'DRAFT' || status === 'PENDING';
}

/** Sales (own or consignment) need the buyer's signed disclosure form before completion. */
export function needsDisclosure(type: DealType): boolean {
  return type !== 'PURCHASE';
}

/** Ownership-transfer tracking applies to completed sales. */
export function hasTransfer(deal: Pick<DealListItem, 'type' | 'status'>): boolean {
  return deal.status === 'COMPLETED' && deal.type !== 'PURCHASE';
}

/**
 * Gap of a price to the price-guide (list) price in percent, rounded to one decimal:
 * negative = under the list price. `null` without a positive list price or a price.
 */
export function listGapPercent(
  price: number | null | undefined,
  listPrice: number | null | undefined,
): number | null {
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  if (!listPrice || !Number.isFinite(listPrice) || listPrice <= 0) return null;
  return Math.round(((price - listPrice) / listPrice) * 1000) / 10;
}

/** Cash the buyer still pays after the trade-in: `price - tradeInValue` (to the agora). */
export function cashDue(
  price: number | null | undefined,
  tradeInValue: number | null | undefined,
): number | null {
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  const tradeIn = tradeInValue && Number.isFinite(tradeInValue) ? tradeInValue : 0;
  return round2(price - tradeIn);
}

export interface SaleVat {
  /** Taxed amount: the margin (MARGIN) or the full price (FULL). */
  base: number;
  /** VAT contained in it. */
  amount: number;
}

/**
 * VAT of a sale preview. MARGIN: `max(0, price - purchase) * r / (100 + r)` (needs the purchase
 * price); FULL: the VAT contained in the price. `null` when it cannot be computed yet.
 */
export function computeSaleVat(
  mode: 'MARGIN' | 'FULL',
  price: number | null | undefined,
  purchasePrice: number | null | undefined,
  rate: number,
): SaleVat | null {
  if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) return null;
  if (mode === 'FULL') return { base: round2(price), amount: vatFromGross(price, rate) };
  if (purchasePrice === null || purchasePrice === undefined || !Number.isFinite(purchasePrice)) {
    return null;
  }
  return {
    base: round2(Math.max(0, price - purchasePrice)),
    amount: vatOnMargin(price, purchasePrice, rate),
  };
}

/** Consignment terms of a cycle (the part `computeCommission` needs). */
export interface CommissionTerms {
  commissionMode: CommissionMode | null;
  commissionValue: number | null;
  minNetToConsignor: number | null;
}

/**
 * Commission and payout of a consignment sale at `price` with the shared rule; `null` when the
 * cycle has no commission rule (or SURPLUS without a minimum net) or there is no price yet.
 */
export function commissionPreview(
  terms: CommissionTerms | null | undefined,
  price: number | null | undefined,
): CommissionResult | null {
  if (!terms?.commissionMode) return null;
  if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) return null;
  if (terms.commissionMode === 'SURPLUS' && terms.minNetToConsignor === null) return null;
  return computeCommission(
    terms.commissionMode,
    terms.commissionValue,
    price,
    terms.minNetToConsignor,
  );
}

/** Whole days a car has been in stock (cycle start to `today`), never negative. */
export function daysInStock(startedAt: string | null | undefined, today: string): number | null {
  if (!startedAt) return null;
  return Math.max(0, diffDays(startedAt.slice(0, 10), today));
}

/** Transfer deadline of a sale completed on `date` (6 working days, holidays ignored). */
export function transferDueDate(date: string): string {
  return addWorkingDays(date, TRANSFER_DUE_WORKING_DAYS);
}

export interface TransferProgress {
  /** Items that apply to the car, in display order. */
  keys: TransferChecklistKey[];
  done: number;
  total: number;
  complete: boolean;
}

/**
 * Roll-up of the transfer checklist. The API sends the items that apply to the car
 * (`taxiLicenseDetached` only for taxis); without a checklist the non-taxi items are assumed.
 */
export function transferProgress(
  checklist: TransferChecklistValue | null | undefined,
): TransferProgress {
  const present = checklist
    ? TRANSFER_CHECKLIST_KEYS.filter((k) => typeof checklist[k] === 'boolean')
    : [];
  const keys = present.length > 0 ? present : transferChecklistKeysFor(false);
  const done = keys.filter((k) => checklist?.[k] === true).length;
  return { keys, done, total: keys.length, complete: done === keys.length };
}

/** TRADE_IN payments are created with the trade-in and cannot be deleted. */
export function isSystemPayment(payment: Pick<DealPayment, 'method'>): boolean {
  return payment.method === 'TRADE_IN';
}

/**
 * Direction offered first in "record payment": money in from the buyer of a sale, money out to
 * the seller of a purchase; a consignment sale whose buyer has paid moves on to the payout.
 */
export function defaultPaymentDirection(
  deal: Pick<DealListItem, 'type' | 'balanceDue' | 'payoutDue'>,
): Direction {
  if (deal.type === 'PURCHASE') return 'OUT';
  if (deal.type === 'CONSIGNMENT_SALE' && deal.balanceDue <= 0 && (deal.payoutDue ?? 0) > 0) {
    return 'OUT';
  }
  return 'IN';
}

/** Amount suggested for a payment in `direction` (what is still due that way), if any. */
export function suggestedPaymentAmount(
  deal: Pick<DealListItem, 'type' | 'balanceDue' | 'payoutDue'>,
  direction: Direction,
): number | null {
  let due = 0;
  if (deal.type === 'PURCHASE') due = direction === 'OUT' ? deal.balanceDue : 0;
  else if (direction === 'IN') due = deal.balanceDue;
  else if (deal.type === 'CONSIGNMENT_SALE') due = deal.payoutDue ?? 0;
  return due > 0 ? round2(due) : null;
}

/** What still blocks completing a deal. */
export type CompletionBlocker = 'disclosureMissing' | 'vehicleLeased';

export function completionBlockers(
  deal: Pick<DealDetail, 'type' | 'disclosureSignedAt'>,
  vehicleStatus: VehicleStatus | null | undefined,
): CompletionBlocker[] {
  const out: CompletionBlocker[] = [];
  if (needsDisclosure(deal.type) && !deal.disclosureSignedAt) out.push('disclosureMissing');
  if (deal.type !== 'PURCHASE' && vehicleStatus === 'LEASED') out.push('vehicleLeased');
  return out;
}
