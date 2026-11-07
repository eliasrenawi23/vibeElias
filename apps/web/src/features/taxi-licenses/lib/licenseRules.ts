import type { LicenseSegment, TaxiLicenseListItem } from '../types';

/** AntD preset colour per licence alert code. */
export const LICENSE_ALERT_COLORS: Readonly<Record<string, string>> = {
  annualFeeDue: 'warning',
  annualFeeOverdue: 'error',
  renewalDue: 'warning',
  renewalOverdue: 'error',
  idle: 'default',
};

/** `/taxi-licenses/:id` link. */
export function licensePath(id: string): string {
  return `/taxi-licenses/${encodeURIComponent(id)}`;
}

/** Badge state of the annual-fee due date from the server's alert codes. */
export function annualFeeState(alerts: readonly string[]): 'overdue' | 'due' | null {
  if (alerts.includes('annualFeeOverdue')) return 'overdue';
  if (alerts.includes('annualFeeDue')) return 'due';
  return null;
}

/**
 * Licences a new lease can use: ACTIVE and not on an open segment, idle ones (no lease for a
 * while) first, then by licence number.
 */
export function availableLicenses(items: readonly TaxiLicenseListItem[]): TaxiLicenseListItem[] {
  return items
    .filter((l) => l.status === 'ACTIVE' && !l.currentSegment)
    .sort((a, b) => {
      const idleA = a.alerts?.includes('idle') ? 0 : 1;
      const idleB = b.alerts?.includes('idle') ? 0 : 1;
      if (idleA !== idleB) return idleA - idleB;
      return a.licenseNo.localeCompare(b.licenseNo, 'en', { numeric: true });
    });
}

/** Monthly rent of the most recent assignment (to prefill a new lease), if any. */
export function lastRent(segments: readonly LicenseSegment[] | undefined): number | null {
  if (!segments || segments.length === 0) return null;
  const latest = [...segments].sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
  return latest ? Number(latest.monthlyRent) : null;
}

/** 31 December of the current year (default annual-fee due date). */
export function defaultAnnualFeeDue(today: string): string {
  return `${today.slice(0, 4)}-12-31`;
}
