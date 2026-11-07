import {
  addDays,
  taxiAgeStatus,
  type DepositKind,
  type LeaseAlert,
  type LeaseEndReason,
  type LeaseStatus,
  type LeaseType,
  type PaymentMethod,
  type VehicleOwnership,
  type VehicleStatus,
} from '@renawi/shared';
import { ErrorKey } from '../common/errors/app-exception';

export interface LeaseAlertInput {
  status: LeaseStatus;
  /** `YYYY-MM-DD`. */
  endDate: string;
  /** An open charge of the contract is past its due date. */
  overdue: boolean;
}

/** Alert codes of a contract on `today` (lead days: `Settings.reminderLeadDays.lease`). */
export function leaseAlerts(c: LeaseAlertInput, today: string, leadDays: number): LeaseAlert[] {
  const alerts: LeaseAlert[] = [];
  if (c.status === 'DRAFT') alerts.push('draft');
  if (c.status === 'ACTIVE') {
    if (c.endDate < today) alerts.push('ended');
    else if (c.endDate <= addDays(today, leadDays)) alerts.push('endingSoon');
  }
  if (c.overdue) alerts.push('overdue');
  return alerts;
}

export interface LeaseVehicleFacts {
  isTaxi: boolean;
  ownership: VehicleOwnership;
  status: VehicleStatus;
  year: number;
  ownerDriverId: string | null;
}

export type LeaseVehicleProblem =
  typeof ErrorKey.vehicleNotAvailable | typeof ErrorKey.taxiAgeBlocked | null;

/**
 * Can this car go on a lease segment starting `onDate`?
 * - CAR_AND_NUMBER: one of our taxis (isTaxi, OWNED) and, when `requireInStock`, IN_STOCK.
 * - NUMBER_ONLY: the driver's own car (THIRD_PARTY, owned by `driverId`).
 * Either way the car must be younger than 12 years (the licence cannot be registered on it).
 */
export function leaseVehicleProblem(
  type: LeaseType,
  v: LeaseVehicleFacts,
  driverId: string,
  onDate: string,
  requireInStock: boolean,
): LeaseVehicleProblem {
  if (type === 'CAR_AND_NUMBER') {
    if (!v.isTaxi || v.ownership !== 'OWNED') return ErrorKey.vehicleNotAvailable;
    if (requireInStock && v.status !== 'IN_STOCK') return ErrorKey.vehicleNotAvailable;
  } else if (v.ownership !== 'THIRD_PARTY' || v.ownerDriverId !== driverId) {
    return ErrorKey.vehicleNotAvailable;
  }
  if (taxiAgeStatus(v.year, onDate).blocked) return ErrorKey.taxiAgeBlocked;
  return null;
}

/** Status after `POST /leases/:id/end`: TERMINATED for early terminations, else ENDED. */
export function statusAfterEnd(reason: Exclude<LeaseEndReason, 'RENEWED'>): LeaseStatus {
  return reason === 'TERMINATED_BY_US' || reason === 'TERMINATED_BY_DRIVER'
    ? 'TERMINATED'
    : 'ENDED';
}

/** Payment method recorded on a `DEPOSIT_IN` of the given deposit kind (null: promissory note). */
export function depositMethodOf(kind: DepositKind): PaymentMethod | null {
  if (kind === 'CASH') return 'CASH';
  if (kind === 'CHECK') return 'CHECK';
  return null;
}
