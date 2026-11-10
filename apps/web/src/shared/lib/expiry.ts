import { diffDays, isValidIsoDate, todayInBusinessTz } from '@renawi/shared';

/** Days ahead in which an expiry counts as "soon" (amber). */
export const EXPIRY_SOON_DAYS = 30;

export type ExpiryState = 'expired' | 'soon' | 'valid';

/**
 * State of an expiry date relative to today (business time zone): past -> expired, within
 * `soonDays` -> soon, otherwise valid. Null for a missing / invalid date.
 */
export function expiryState(
  iso: string | null | undefined,
  today: string = todayInBusinessTz(),
  soonDays: number = EXPIRY_SOON_DAYS,
): ExpiryState | null {
  if (!iso || !isValidIsoDate(iso)) return null;
  const days = diffDays(today, iso);
  if (days < 0) return 'expired';
  if (days <= soonDays) return 'soon';
  return 'valid';
}

/** Whole days from today to `iso` (negative when past). */
export function daysUntil(iso: string, today: string = todayInBusinessTz()): number {
  return diffDays(today, iso);
}
