import {
  addDays,
  dealerRegistrationStatus,
  MANUAL_VEHICLE_STATUS_TRANSITIONS,
  taxiAgeStatus,
  type VehicleAlert,
  type VehicleStatus,
} from '@renawi/shared';
import { ErrorKey } from '../common/errors/app-exception';

/* ------------------------------------------------------------------------------------------ */
/* Status transitions (POST /vehicles/:id/status)                                             */
/* ------------------------------------------------------------------------------------------ */

/** Side effect of an allowed manual status change. */
export type TransitionEffect =
  | 'none'
  /** EXTERNAL -> IN_STOCK: the car becomes ours (OWNED) and an OWNED cycle opens. */
  | 'openOwnedCycle'
  /** -> SCRAPPED: the open cycle ends with reason SCRAPPED. */
  | 'closeCycleScrapped';

export type TransitionResult =
  | { ok: true; noop: boolean; effect: TransitionEffect }
  | {
      ok: false;
      error:
        | typeof ErrorKey.useDeal
        | typeof ErrorKey.invalidTransition
        | typeof ErrorKey.vehicleLeased;
    };

export interface TransitionContext {
  /** The vehicle sits on an open lease segment. */
  hasOpenSegment: boolean;
}

/**
 * Decides a manual status change. Same status = no-op; SOLD only via deals (`errors.useDeal`);
 * LEASED -> IN_STOCK needs the lease segment closed first (`errors.vehicleLeased`); everything
 * outside `MANUAL_VEHICLE_STATUS_TRANSITIONS` is `errors.invalidTransition`.
 */
export function checkStatusTransition(
  from: VehicleStatus,
  to: VehicleStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (from === to) return { ok: true, noop: true, effect: 'none' };
  if (to === 'SOLD') return { ok: false, error: ErrorKey.useDeal };
  if (!MANUAL_VEHICLE_STATUS_TRANSITIONS[from].includes(to)) {
    return { ok: false, error: ErrorKey.invalidTransition };
  }
  if (from === 'LEASED' && ctx.hasOpenSegment) return { ok: false, error: ErrorKey.vehicleLeased };
  if (from === 'EXTERNAL' && to === 'IN_STOCK') {
    return { ok: true, noop: false, effect: 'openOwnedCycle' };
  }
  if (to === 'SCRAPPED') return { ok: true, noop: false, effect: 'closeCycleScrapped' };
  return { ok: true, noop: false, effect: 'none' };
}

/** Statuses in which an OWNED car is part of our stock (and has an open inventory cycle). */
export const STOCK_STATUSES: ReadonlySet<VehicleStatus> = new Set<VehicleStatus>([
  'IN_STOCK',
  'RESERVED',
  'LEASED',
]);

/* ------------------------------------------------------------------------------------------ */
/* Alerts                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Vehicles that left us: no alerts. */
const GONE_STATUSES: ReadonlySet<VehicleStatus> = new Set<VehicleStatus>([
  'SOLD',
  'SCRAPPED',
  'RETURNED',
]);

export interface VehicleAlertInput {
  year: number;
  isTaxi: boolean;
  status: VehicleStatus;
  /** `YYYY-MM-DD` or null. */
  registrationExpiry: string | null;
  /** `YYYY-MM-DD` or null. */
  dealerRegisteredAt: string | null;
}

/**
 * Computed alert codes for a vehicle on `today` (business date):
 * registration expired / expiring within `registrationLeadDays`, 11 months on dealer
 * registration, and for taxis the age rules (10 years semi-annual test, 11.5 near the limit,
 * 12 blocked; `taxiAge10` stays set once the car is 10 or older).
 */
export function vehicleAlerts(
  v: VehicleAlertInput,
  today: string,
  registrationLeadDays: number,
): VehicleAlert[] {
  if (GONE_STATUSES.has(v.status)) return [];
  const alerts: VehicleAlert[] = [];
  if (v.registrationExpiry) {
    if (v.registrationExpiry < today) alerts.push('registrationExpired');
    else if (v.registrationExpiry <= addDays(today, registrationLeadDays)) {
      alerts.push('registrationExpiring');
    }
  }
  if (v.dealerRegisteredAt && v.dealerRegisteredAt <= today) {
    if (dealerRegistrationStatus(v.dealerRegisteredAt, today).alert) {
      alerts.push('dealerRegistration11Months');
    }
  }
  if (v.isTaxi) {
    const age = taxiAgeStatus(v.year, today);
    if (age.semiAnnualTest) alerts.push('taxiAge10');
    if (age.nearLimit) alerts.push('taxiAgeNearLimit');
    if (age.blocked) alerts.push('taxiAgeBlocked');
  }
  return alerts;
}
