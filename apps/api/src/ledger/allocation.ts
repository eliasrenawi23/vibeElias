import Decimal from 'decimal.js';
import { round2, type DecimalValue } from '@renawi/shared';

/*
 * FIFO allocation of payments / credits to charges (the `PaymentAllocation` cache behind the
 * ageing view). Pure: the ledger service loads a driver's non-voided entries, calls
 * `allocateFifo` and replaces the driver's allocation rows with the result.
 *
 * Order: payments and credits by date (then id); open charges by due date (falling back to the
 * charge date), then date, then id. A payment's explicit `allocateTo` charges are settled first
 * (in the given order), the rest goes FIFO.
 */

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export interface FifoCharge {
  id: string;
  amount: DecimalValue;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `YYYY-MM-DD` or null (then the charge date counts). */
  dueDate: string | null;
}

export interface FifoPayment {
  id: string;
  amount: DecimalValue;
  /** `YYYY-MM-DD`. */
  date: string;
  /** Charge ids to settle first, in this order. */
  allocateTo?: readonly string[];
}

export interface FifoAllocation {
  paymentId: string;
  chargeId: string;
  amount: number;
}

export function chargeOrder(a: FifoCharge, b: FifoCharge): number {
  return (
    (a.dueDate ?? a.date).localeCompare(b.dueDate ?? b.date) ||
    a.date.localeCompare(b.date) ||
    a.id.localeCompare(b.id)
  );
}

export function paymentOrder(a: FifoPayment, b: FifoPayment): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
}

/** Allocates payments/credits to charges (see the file comment). Amounts have 2 decimals. */
export function allocateFifo(
  charges: readonly FifoCharge[],
  payments: readonly FifoPayment[],
): FifoAllocation[] {
  const open = [...charges]
    .sort(chargeOrder)
    .map((c) => ({ id: c.id, left: new D(c.amount.toString()) }));
  const byId = new Map(open.map((c) => [c.id, c]));
  const totals = new Map<string, Decimal>();
  const key = (paymentId: string, chargeId: string) => `${paymentId}\u0000${chargeId}`;

  for (const payment of [...payments].sort(paymentOrder)) {
    let left = new D(payment.amount.toString());
    const take = (charge: { id: string; left: Decimal }) => {
      if (left.lte(0) || charge.left.lte(0)) return;
      const amount = D.min(left, charge.left);
      charge.left = charge.left.minus(amount);
      left = left.minus(amount);
      const k = key(payment.id, charge.id);
      totals.set(k, (totals.get(k) ?? new D(0)).plus(amount));
    };
    for (const id of payment.allocateTo ?? []) {
      const charge = byId.get(id);
      if (charge) take(charge);
    }
    for (const charge of open) {
      if (left.lte(0)) break;
      take(charge);
    }
  }

  const out: FifoAllocation[] = [];
  for (const [k, amount] of totals) {
    const [paymentId, chargeId] = k.split('\u0000') as [string, string];
    out.push({ paymentId, chargeId, amount: round2(amount) });
  }
  return out;
}
