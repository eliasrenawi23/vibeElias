/** AntD preset colour per driver alert code. */
export const DRIVER_ALERT_COLORS: Readonly<Record<string, string>> = {
  licenseExpired: 'error',
  licenseExpiring: 'warning',
  taxiPermitExpired: 'error',
  taxiPermitExpiring: 'warning',
  medicalExpired: 'error',
  medicalExpiring: 'warning',
  overdue: 'error',
};

/** `/drivers/:id` link. */
export function driverPath(id: string): string {
  return `/drivers/${encodeURIComponent(id)}`;
}
