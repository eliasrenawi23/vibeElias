import { addDays, addMonths, type DepositKind, type LedgerPaymentMethod } from '@renawi/shared';

/** AntD preset colour per lease alert code. */
export const LEASE_ALERT_COLORS: Readonly<Record<string, string>> = {
  endingSoon: 'warning',
  ended: 'default',
  overdue: 'error',
  draft: 'processing',
};

/** `/leases/:id` link. */
export function leasePath(id: string): string {
  return `/leases/${encodeURIComponent(id)}`;
}

/**
 * Early-exit penalty: `months x monthly rent`, exact to the agora (both inputs have at most two
 * decimals, so the product is computed in integer hundredths and rounded half-up once).
 */
export function computePenalty(
  months: number | null | undefined,
  rent: number | null | undefined,
): number {
  const m = Math.round(Number(months ?? 0) * 100);
  const r = Math.round(Number(rent ?? 0) * 100);
  if (!Number.isFinite(m) || !Number.isFinite(r) || m <= 0 || r <= 0) return 0;
  // m * r is in 1/10,000 ILS; round half-up to agorot.
  return Math.floor((m * r + 50) / 100) / 100;
}

/** True when the contract ends before its agreed end date (an early exit). */
export function isEarlyExit(actualEndDate: string | null | undefined, endDate: string): boolean {
  return Boolean(actualEndDate && actualEndDate < endDate);
}

/** Default end of a new contract: one year after the start, inclusive (start + 12 months - 1 day). */
export function defaultEndDate(startDate: string, months = 12): string {
  return addDays(addMonths(startDate, months), -1);
}

/** Payment method that matches a deposit kind (for the deposit receipt). */
export function methodForDepositKind(kind: DepositKind | null | undefined): LedgerPaymentMethod {
  return kind === 'CHECK' ? 'CHECK' : 'CASH';
}
