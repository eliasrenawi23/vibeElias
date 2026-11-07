import type { LedgerType } from '@renawi/shared';
import type { LedgerEntry } from '../types';

/** Deposits are held outside the balance (they never change what the driver owes). */
export const DEPOSIT_TYPES: readonly LedgerType[] = [
  'DEPOSIT_IN',
  'DEPOSIT_OUT',
  'DEPOSIT_APPLIED',
];

export function isDeposit(type: LedgerType): boolean {
  return DEPOSIT_TYPES.includes(type);
}

/** Effect of a row on the balance in agorot: CHARGE +, PAYMENT / CREDIT -, deposits and voided 0. */
export function balanceEffectAgorot(
  entry: Pick<LedgerEntry, 'type' | 'amount' | 'voidedAt'>,
): number {
  if (entry.voidedAt) return 0;
  const agorot = Math.round(Number(entry.amount) * 100);
  if (entry.type === 'CHARGE') return agorot;
  if (entry.type === 'PAYMENT' || entry.type === 'CREDIT') return -agorot;
  return 0;
}

/** Effect of a row on the deposit held, in agorot: IN +, OUT / APPLIED -, voided 0. */
export function depositEffectAgorot(
  entry: Pick<LedgerEntry, 'type' | 'amount' | 'voidedAt'>,
): number {
  if (entry.voidedAt) return 0;
  const agorot = Math.round(Number(entry.amount) * 100);
  if (entry.type === 'DEPOSIT_IN') return agorot;
  if (entry.type === 'DEPOSIT_OUT' || entry.type === 'DEPOSIT_APPLIED') return -agorot;
  return 0;
}

export interface StatementRow extends LedgerEntry {
  /** Balance after the row (null for voided rows, which do not count). */
  balanceAfter: number | null;
}

/**
 * Rows (oldest to newest) with the balance after each one. The API's `runningBalance` is used
 * when every counted row carries it; otherwise it is computed from the rows themselves (e.g. a
 * contract-scoped list), starting at `opening`.
 */
export function withRunningBalance(items: readonly LedgerEntry[], opening = 0): StatementRow[] {
  const counted = items.filter((e) => !e.voidedAt);
  const fromApi =
    counted.length > 0 &&
    counted.every((e) => typeof e.runningBalance === 'number' && Number.isFinite(e.runningBalance));
  let agorot = Math.round(opening * 100);
  return items.map((e) => {
    if (e.voidedAt) return { ...e, balanceAfter: null };
    agorot += balanceEffectAgorot(e);
    return { ...e, balanceAfter: fromApi ? Number(e.runningBalance) : agorot / 100 };
  });
}

/** Sort rows oldest first (date, then the API order). */
export function oldestFirst(items: readonly LedgerEntry[]): LedgerEntry[] {
  return items
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.date === b.e.date ? a.i - b.i : a.e.date < b.e.date ? -1 : 1))
    .map(({ e }) => e);
}

/** Open (unpaid) part of a charge, if the API reports it. */
export function openAmount(entry: LedgerEntry): number | null {
  if (entry.type !== 'CHARGE' || entry.voidedAt) return null;
  if (typeof entry.remaining === 'number') return entry.remaining;
  if (typeof entry.allocated === 'number') {
    return (Math.round(Number(entry.amount) * 100) - Math.round(entry.allocated * 100)) / 100;
  }
  return null;
}
