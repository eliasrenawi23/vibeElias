import { LedgerEntry, Prisma } from '@prisma/client';
import { z } from 'zod';
import type { NamedRef } from '../common/refs';
import { isDecimal } from '../prisma/prisma.decimal';

/** A `numeric` column of a raw query (Prisma returns `Prisma.Decimal`). */
const numeric = z.custom<Prisma.Decimal>((v) => isDecimal(v), { message: 'numeric expected' });

/** Row of `driver_balance_v` (migration `partial_indexes_and_views`). */
export const BalanceRowSchema = z.object({
  driverId: z.string(),
  charged: numeric,
  paid: numeric,
  credited: numeric,
  balance: numeric,
  deposit_held: numeric,
});
export type BalanceRow = z.infer<typeof BalanceRowSchema>;

/** Row of `driver_ageing_v` (only drivers with open charges). */
export const AgeingRowSchema = z.object({
  driverId: z.string(),
  current: numeric,
  d1_30: numeric,
  d31_60: numeric,
  d61_90: numeric,
  d90_plus: numeric,
  total: numeric,
});
export type AgeingRow = z.infer<typeof AgeingRowSchema>;

/** Driver-level totals (`balance > 0` = the driver owes us; deposits are held outside it). */
export interface BalanceView {
  charged: Prisma.Decimal;
  paid: Prisma.Decimal;
  credited: Prisma.Decimal;
  balance: Prisma.Decimal;
  depositHeld: Prisma.Decimal;
}

/** Open charge amounts by days past due. */
export interface AgeingView {
  current: Prisma.Decimal;
  d1_30: Prisma.Decimal;
  d31_60: Prisma.Decimal;
  d61_90: Prisma.Decimal;
  d90_plus: Prisma.Decimal;
  total: Prisma.Decimal;
}

const ZERO = new Prisma.Decimal(0);

export const ZERO_BALANCE: Readonly<BalanceView> = Object.freeze({
  charged: ZERO,
  paid: ZERO,
  credited: ZERO,
  balance: ZERO,
  depositHeld: ZERO,
});

export const ZERO_AGEING: Readonly<AgeingView> = Object.freeze({
  current: ZERO,
  d1_30: ZERO,
  d31_60: ZERO,
  d61_90: ZERO,
  d90_plus: ZERO,
  total: ZERO,
});

export function toBalanceView(row: BalanceRow | undefined): BalanceView {
  if (!row) return { ...ZERO_BALANCE };
  return {
    charged: row.charged,
    paid: row.paid,
    credited: row.credited,
    balance: row.balance,
    depositHeld: row.deposit_held,
  };
}

export function toAgeingView(row: AgeingRow | undefined): AgeingView {
  if (!row) return { ...ZERO_AGEING };
  const { driverId: _driverId, ...buckets } = row;
  return buckets;
}

/** Amount past due (every bucket except `current`). */
export function overdueAmount(ageing: AgeingView): Prisma.Decimal {
  return ageing.total.minus(ageing.current);
}

/**
 * Ledger entry on the wire: the row + its driver; for charges the allocated / remaining amounts
 * (from the FIFO cache; 0 remaining when voided), null for the other types.
 */
export type LedgerEntryView = LedgerEntry & {
  driver: NamedRef;
  allocated: Prisma.Decimal | null;
  remaining: Prisma.Decimal | null;
  /** Documents stored on the entry (generated deposit / payment confirmations). */
  documentCount: number;
};

/** `GET /drivers/:id/ledger` item: entry view + running balance after the entry. */
export type StatementEntry = LedgerEntryView & { runningBalance: Prisma.Decimal };

/** Signed effect of a non-voided entry on the balance (deposits do not move it). */
export function balanceEffect(entry: Pick<LedgerEntry, 'type' | 'amount'>): Prisma.Decimal {
  switch (entry.type) {
    case 'CHARGE':
      return entry.amount;
    case 'PAYMENT':
    case 'CREDIT':
      return entry.amount.negated();
    default:
      return ZERO;
  }
}
