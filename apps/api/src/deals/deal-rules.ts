import {
  addDays,
  addWorkingDays,
  computeCommission,
  createTransferChecklist,
  round2,
  sumMoney,
  TRANSFER_DUE_WORKING_DAYS,
  TransferChecklistSchema,
  transferStatusFromChecklist,
  vatFromGross,
  vatOnMargin,
  type CommissionMode,
  type DealAlert,
  type DealStatus,
  type DealType,
  type DecimalValue,
  type Direction,
  type PaymentMethod,
  type TransferChecklist,
  type TransferStatus,
  type VatMode,
} from '@renawi/shared';

/**
 * Pure deal rules (no I/O): VAT, consignment commission, payment totals, alerts, the
 * ownership-transfer due date and the transfer-checklist roll-up.
 */

/* ------------------------------------------------------------------------------------------ */
/* VAT                                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** `vat` block of `GET /deals/:id`. */
export interface DealVat {
  mode: VatMode;
  /** Percent snapshot of the deal. */
  rate: number;
  /** Amount VAT is computed on: the margin (MARGIN), the price (FULL) or 0 (NONE). */
  base: number;
  /** VAT contained in the base (prices are VAT-inclusive): `base * rate / (100 + rate)`. */
  amount: number;
}

/**
 * VAT of a deal. MARGIN (licensed dealer, VAT on the margin): `base = max(0, price - purchase)`,
 * a negative margin owes nothing. FULL (bought from a VAT-registered business that deducted
 * input VAT): `base = price`. NONE: 0. An unknown purchase price counts as 0.
 */
export function dealVat(
  mode: VatMode,
  rate: DecimalValue,
  price: DecimalValue,
  purchasePrice: DecimalValue | null | undefined,
): DealVat {
  const r = round2(rate);
  switch (mode) {
    case 'MARGIN': {
      const purchase = purchasePrice ?? 0;
      const margin = round2(sumMoney([price, -round2(purchase)]));
      return {
        mode,
        rate: r,
        base: Math.max(0, margin),
        amount: vatOnMargin(price, purchase, rate),
      };
    }
    case 'FULL':
      return { mode, rate: r, base: round2(price), amount: vatFromGross(price, rate) };
    case 'NONE':
      return { mode, rate: r, base: 0, amount: 0 };
    default: {
      const exhaustive: never = mode;
      throw new RangeError(`Unknown VAT mode ${String(exhaustive)}`);
    }
  }
}

/**
 * VAT mode of a SALE: FULL is forced when the cycle's purchase was from a VAT-registered
 * business (`sellerIsVatBusiness`); otherwise the requested mode, MARGIN by default.
 */
export function saleVatMode(
  requested: VatMode | null | undefined,
  purchaseFromVatBusiness: boolean,
): VatMode {
  if (purchaseFromVatBusiness) return 'FULL';
  return requested ?? 'MARGIN';
}

/** VAT mode of a PURCHASE: FULL from a VAT-registered business (input VAT), else NONE. */
export function purchaseVatMode(sellerIsVatBusiness: boolean): VatMode {
  return sellerIsVatBusiness ? 'FULL' : 'NONE';
}

/* ------------------------------------------------------------------------------------------ */
/* Consignment                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Commission terms of a CONSIGNED inventory cycle. */
export interface ConsignmentRule {
  commissionMode: CommissionMode | null;
  commissionValue: DecimalValue | null;
  minNetToConsignor: DecimalValue | null;
}

/**
 * Commission and consignor payout of a consignment sale at `price` (shared
 * `computeCommission`: FIXED / PERCENT / SURPLUS over the minimum net). A cycle without a rule
 * (or SURPLUS without a minimum net) earns no commission.
 */
export function consignmentAmounts(
  rule: ConsignmentRule,
  price: DecimalValue,
): { commission: number; payout: number } {
  const mode = rule.commissionMode;
  if (!mode || (mode === 'SURPLUS' && rule.minNetToConsignor == null)) {
    return { commission: 0, payout: round2(price) };
  }
  const r = computeCommission(mode, rule.commissionValue, price, rule.minNetToConsignor);
  return { commission: r.commission, payout: r.payout };
}

/* ------------------------------------------------------------------------------------------ */
/* Payments                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export interface PaymentLike {
  direction: Direction;
  method: PaymentMethod;
  amount: DecimalValue;
}

/** Money summary of a deal. */
export interface DealMoney {
  /** Money received, TRADE_IN rows excluded. */
  paidIn: number;
  /** Money paid out, TRADE_IN rows excluded. */
  paidOut: number;
  /** TRADE_IN rows: the trade-in value (IN on the sale, OUT on the trade-in purchase). */
  tradeInValue: number;
  /**
   * SALE: `price - tradeInValue - paidIn` (buyer owes us). PURCHASE: `price - tradeInValue -
   * paidOut` (we owe the seller). CONSIGNMENT_SALE: `price - paidIn` (buyer owes us).
   * Negative = overpaid.
   */
  balanceDue: number;
  /** CONSIGNMENT_SALE: `payoutAmount - paidOut` (we owe the consignor); null otherwise. */
  payoutDue: number | null;
}

export function dealMoney(
  deal: { type: DealType; price: DecimalValue; payoutAmount: DecimalValue | null },
  payments: readonly PaymentLike[],
): DealMoney {
  const sum = (pred: (p: PaymentLike) => boolean) =>
    sumMoney(payments.filter(pred).map((p) => p.amount));
  const paidIn = sum((p) => p.direction === 'IN' && p.method !== 'TRADE_IN');
  const paidOut = sum((p) => p.direction === 'OUT' && p.method !== 'TRADE_IN');
  const tradeInValue = sum((p) => p.method === 'TRADE_IN');
  switch (deal.type) {
    case 'SALE':
      return {
        paidIn,
        paidOut,
        tradeInValue,
        balanceDue: sumMoney([deal.price, -tradeInValue, -paidIn]),
        payoutDue: null,
      };
    case 'PURCHASE':
      return {
        paidIn,
        paidOut,
        tradeInValue,
        balanceDue: sumMoney([deal.price, -tradeInValue, -paidOut]),
        payoutDue: null,
      };
    case 'CONSIGNMENT_SALE':
      return {
        paidIn,
        paidOut,
        tradeInValue,
        balanceDue: sumMoney([deal.price, -paidIn]),
        payoutDue: sumMoney([deal.payoutAmount ?? deal.price, -paidOut]),
      };
    default: {
      const exhaustive: never = deal.type;
      throw new RangeError(`Unknown deal type ${String(exhaustive)}`);
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Alerts and transfer deadline                                                               */
/* ------------------------------------------------------------------------------------------ */

/** The buyer must be registered within 6 working days (Sun-Thu week; holidays ignored). */
export function transferDueDate(saleDate: string): string {
  return addWorkingDays(saleDate, TRANSFER_DUE_WORKING_DAYS);
}

export interface DealAlertInput {
  type: DealType;
  status: DealStatus;
  hasDisclosure: boolean;
  transferStatus: TransferStatus;
  /** `YYYY-MM-DD` or null. */
  transferDueAt: string | null;
  balanceDue: number;
  payoutDue: number | null;
}

/**
 * Alert codes of a deal on `today`: `disclosureMissing` (open sale without the signed form),
 * `transferDue` (completed sale, transfer not done, due within `transferLeadDays`),
 * `transferOverdue` (past due) and `unpaid` (completed with money still owed either way).
 */
export function dealAlerts(
  d: DealAlertInput,
  today: string,
  transferLeadDays: number,
): DealAlert[] {
  const alerts: DealAlert[] = [];
  const isSale = d.type === 'SALE' || d.type === 'CONSIGNMENT_SALE';
  const open = d.status === 'DRAFT' || d.status === 'PENDING';
  if (isSale && open && !d.hasDisclosure) alerts.push('disclosureMissing');
  if (d.status === 'COMPLETED') {
    if (isSale && d.transferStatus !== 'DONE' && d.transferDueAt) {
      if (d.transferDueAt < today) alerts.push('transferOverdue');
      else if (d.transferDueAt <= addDays(today, transferLeadDays)) alerts.push('transferDue');
    }
    if (d.balanceDue > 0 || (d.payoutDue ?? 0) > 0) alerts.push('unpaid');
  }
  return alerts;
}

/* ------------------------------------------------------------------------------------------ */
/* Transfer checklist                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Stored checklist merged over the defaults; `taxiLicenseDetached` only for taxis. */
export type TransferChecklistView = Omit<TransferChecklist, 'taxiLicenseDetached'> & {
  taxiLicenseDetached?: boolean;
};

/** Merges a stored (possibly partial / malformed) checklist JSON with the shared defaults. */
export function mergeTransferChecklist(
  stored: unknown,
  isTaxi: boolean,
  patch?: Partial<TransferChecklist>,
): TransferChecklistView {
  const base = createTransferChecklist();
  const parsed = TransferChecklistSchema.partial().safeParse(stored ?? {});
  const merged: TransferChecklist = { ...base };
  const assign = (src: Partial<TransferChecklist> | undefined) => {
    for (const [k, v] of Object.entries(src ?? {})) {
      if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
    }
  };
  if (parsed.success) assign(parsed.data);
  assign(patch);
  if (isTaxi) return merged;
  const { taxiLicenseDetached: _omit, ...rest } = merged;
  return rest;
}

const STATUS_RANK: Record<TransferStatus, number> = { NOT_STARTED: 0, IN_PROGRESS: 1, DONE: 2 };

function maxStatus(a: TransferStatus, b: TransferStatus): TransferStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export interface TransferRollUpInput {
  storedStatus: TransferStatus;
  storedTransferredAt: string | null;
  /** The merged checklist after the patch. */
  checklist: Partial<TransferChecklist>;
  isTaxi: boolean;
  /** `transferStatus` sent in the request. */
  explicitStatus?: TransferStatus;
  /** `transferredAt` sent in the request (`null` clears it, `undefined` = not sent). */
  explicitTransferredAt?: string | null;
  today: string;
}

/**
 * Transfer status after a `PATCH /deals/:id/transfer`:
 * - DONE when `transferStatus: DONE` or a `transferredAt` date is sent;
 * - otherwise the higher of the base status and what the checklist implies (none ticked ->
 *   NOT_STARTED, some -> IN_PROGRESS, all applicable -> DONE). The base is the explicit status
 *   when sent (so it can lower a stored status), else the stored one (never lowered
 *   implicitly); clearing `transferredAt` lowers a stored DONE to IN_PROGRESS.
 * `transferredAt` is kept only while DONE (default: the stored date, else today).
 */
export function rollUpTransfer(i: TransferRollUpInput): {
  status: TransferStatus;
  transferredAt: string | null;
} {
  const computed = transferStatusFromChecklist(i.checklist, i.isTaxi);
  let status: TransferStatus;
  if (i.explicitStatus === 'DONE' || i.explicitTransferredAt) {
    status = 'DONE';
  } else {
    let base = i.explicitStatus ?? i.storedStatus;
    if (i.explicitTransferredAt === null && base === 'DONE') base = 'IN_PROGRESS';
    status = maxStatus(base, computed);
  }
  const transferredAt =
    status === 'DONE'
      ? (i.explicitTransferredAt ??
        (i.explicitTransferredAt === null ? null : i.storedTransferredAt) ??
        i.today)
      : null;
  return { status, transferredAt };
}
