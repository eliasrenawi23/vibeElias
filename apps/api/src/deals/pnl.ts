import {
  netFromGross,
  round2,
  sumMoney,
  vatFromGross,
  type CycleKind,
  type DecimalValue,
  type PaidBy,
  type VatMode,
} from '@renawi/shared';
import { consignmentAmounts, ConsignmentRule, dealVat } from './deal-rules';

/**
 * Pure P&L arithmetic of one inventory cycle (`GET /vehicles/:id/pnl`). Money in, numbers out
 * (2 decimals, half-up).
 *
 * - revenue: sale price (OWNED) or our commission (CONSIGNED) + lease income attributed to the
 *   car within the cycle (charges minus credits) + expenses passed on to drivers (rebilled).
 * - costs: purchase price + expenses paid by us (net of reclaimable VAT) + VAT: the sale's VAT
 *   (margin or full) minus the input VAT of a FULL-VAT purchase.
 * - an open cycle uses the listing price as a proxy sale (`unrealised`).
 */

export interface PnlExpense {
  amount: DecimalValue;
  paidBy: PaidBy;
  vatIncluded: boolean;
  vatReclaimable: boolean;
}

export interface PnlDeal {
  price: DecimalValue;
  vatMode: VatMode;
  vatRate: DecimalValue;
}

export interface CyclePnlInput {
  kind: CycleKind;
  open: boolean;
  /** The cycle's (non-cancelled) purchase deal; null for stock entered without one. */
  purchase: PnlDeal | null;
  /** The COMPLETED sale / consignment sale that closed the cycle. */
  sale: (PnlDeal & { commissionAmount: DecimalValue | null }) | null;
  /** Proxy sale price of an open cycle. */
  listingPrice: DecimalValue | null;
  /** Commission terms (CONSIGNED). */
  consignment: ConsignmentRule | null;
  expenses: readonly PnlExpense[];
  /** Current VAT rate (reclaimable expense VAT, VAT of an unrealised sale). */
  vatRate: DecimalValue;
  /** Lease income attributed to the car within the cycle: charges (not rebilled) - credits. */
  leaseIncome: DecimalValue;
  /** Charges created by passing the cycle's expenses on to drivers. */
  rebilled: DecimalValue;
}

export interface CyclePnl {
  purchasePrice: number | null;
  salePrice: number | null;
  listingPrice: number | null;
  /** CONSIGNED: our commission (realised, or from the rule at the listing price); else null. */
  commission: number | null;
  revenue: {
    sale: number;
    commission: number;
    leaseIncome: number;
    rebilled: number;
    total: number;
  };
  costs: { purchase: number; expenses: number; vatOnMargin: number; total: number };
  profit: number;
  unrealised: boolean;
}

/** Expenses paid by the business; reclaimable VAT of VAT-inclusive amounts is taken out. */
export function expenseCost(expenses: readonly PnlExpense[], vatRate: DecimalValue): number {
  return sumMoney(
    expenses
      .filter((e) => e.paidBy === 'US')
      .map((e) => (e.vatReclaimable && e.vatIncluded ? netFromGross(e.amount, vatRate) : e.amount)),
  );
}

export function cyclePnl(i: CyclePnlInput): CyclePnl {
  const unrealised = i.open && !i.sale;
  const listingPrice = i.listingPrice == null ? null : round2(i.listingPrice);
  const purchasePrice = i.purchase ? round2(i.purchase.price) : null;
  const salePrice = i.sale ? round2(i.sale.price) : null;

  let saleRevenue = 0;
  let commission: number | null = null;
  let purchaseCost = 0;
  let vat = 0;

  if (i.kind === 'OWNED') {
    purchaseCost = purchasePrice ?? 0;
    const inputVat =
      i.purchase && i.purchase.vatMode === 'FULL'
        ? vatFromGross(i.purchase.price, i.purchase.vatRate)
        : 0;
    let saleVat = 0;
    if (i.sale) {
      saleRevenue = round2(i.sale.price);
      saleVat = dealVat(i.sale.vatMode, i.sale.vatRate, i.sale.price, purchasePrice).amount;
    } else if (unrealised && listingPrice) {
      saleRevenue = listingPrice;
      const mode: VatMode = i.purchase?.vatMode === 'FULL' ? 'FULL' : 'MARGIN';
      saleVat = dealVat(mode, i.vatRate, listingPrice, purchasePrice).amount;
    }
    vat = sumMoney([saleVat, -inputVat]);
  } else {
    const rule = i.consignment ?? {
      commissionMode: null,
      commissionValue: null,
      minNetToConsignor: null,
    };
    if (i.sale) {
      commission =
        i.sale.commissionAmount != null
          ? round2(i.sale.commissionAmount)
          : consignmentAmounts(rule, i.sale.price).commission;
    } else if (unrealised && listingPrice) {
      commission = consignmentAmounts(rule, listingPrice).commission;
    } else {
      commission = 0;
    }
  }

  const leaseIncome = round2(i.leaseIncome);
  const rebilled = round2(i.rebilled);
  const expenses = expenseCost(i.expenses, i.vatRate);
  const revenueTotal = sumMoney([saleRevenue, commission ?? 0, leaseIncome, rebilled]);
  const costsTotal = sumMoney([purchaseCost, expenses, vat]);
  return {
    purchasePrice,
    salePrice,
    listingPrice,
    commission,
    revenue: {
      sale: saleRevenue,
      commission: commission ?? 0,
      leaseIncome,
      rebilled,
      total: revenueTotal,
    },
    costs: { purchase: purchaseCost, expenses, vatOnMargin: vat, total: costsTotal },
    profit: sumMoney([revenueTotal, -costsTotal]),
    unrealised,
  };
}
