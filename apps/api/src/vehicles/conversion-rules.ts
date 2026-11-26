import type { Prisma } from '@prisma/client';
import {
  formatPlate,
  isTaxiPlate,
  round2,
  sumMoney,
  type DecimalValue,
  type VehicleOwnership,
  type VehicleStatus,
} from '@renawi/shared';
import { ErrorKey, FieldErrorKey } from '../common/errors/app-exception';

/*
 * Pure rules of the taxi -> private conversion (`POST /vehicles/:id/convert-to-private`,
 * `PATCH /vehicles/:id/conversion`): blockers, plate and date checks, the new asking price and
 * the "former taxi" read model. No I/O.
 */

/** Error keys that block a conversion (`canConvert.blockers` of `GET /vehicles/:id`). */
export type ConversionBlocker =
  | typeof ErrorKey.vehicleNotTaxi
  | typeof ErrorKey.vehicleNotAvailable
  | typeof ErrorKey.vehicleLeased
  | typeof ErrorKey.invalidTransition
  | typeof ErrorKey.licenseStillRegistered;

export interface ConversionState {
  isTaxi: boolean;
  ownership: VehicleOwnership;
  status: VehicleStatus;
  /** The car sits on an open lease segment. */
  hasOpenSegment: boolean;
  /** A taxi licence is registered on the car (`TaxiLicense.registeredVehicleId`). */
  hasRegisteredLicense: boolean;
}

/**
 * Every rule of the vehicle's state that currently blocks a conversion, in rule order, each key
 * once: not a taxi (`errors.vehicleNotTaxi`), not ours (`errors.vehicleNotAvailable`), LEASED
 * or on an open lease segment (`errors.vehicleLeased`), any other status than IN_STOCK /
 * RESERVED (`errors.invalidTransition`), a taxi licence still registered on it
 * (`errors.licenseStillRegistered`). Empty = allowed.
 */
export function conversionBlockers(v: ConversionState): ConversionBlocker[] {
  const out: ConversionBlocker[] = [];
  const add = (key: ConversionBlocker) => {
    if (!out.includes(key)) out.push(key);
  };
  if (!v.isTaxi) add(ErrorKey.vehicleNotTaxi);
  if (v.ownership !== 'OWNED') add(ErrorKey.vehicleNotAvailable);
  if (v.status === 'LEASED') add(ErrorKey.vehicleLeased);
  else if (v.status !== 'IN_STOCK' && v.status !== 'RESERVED') add(ErrorKey.invalidTransition);
  if (v.hasOpenSegment) add(ErrorKey.vehicleLeased);
  if (v.hasRegisteredLicense) add(ErrorKey.licenseStillRegistered);
  return out;
}

/**
 * Field error of the new private plate (canonical digits) against the taxi plate it replaces:
 * the same plate (`validation.samePlate`) or another taxi plate ending in 25 / 26
 * (`validation.privatePlateExpected`). Uniqueness is checked against the database separately.
 */
export function newPlateError(newPlateNo: string, oldPlateNo: string): string | null {
  if (newPlateNo === oldPlateNo) return FieldErrorKey.samePlate;
  if (isTaxiPlate(newPlateNo)) return FieldErrorKey.privatePlateExpected;
  return null;
}

/** Inventory cycle bounds (`YYYY-MM-DD`; `endedAt` null = open). */
export interface CycleBounds {
  startedAt: string;
  endedAt: string | null;
}

/**
 * Field error of the conversion date: in the future (`validation.dateInFuture`) or outside the
 * cycle the customs cost belongs to (`validation.outsideCycle`: before it started or after it
 * ended). No cycle = only the future check.
 */
export function conversionDateError(
  date: string,
  today: string,
  cycle: CycleBounds | null,
): string | null {
  if (date > today) return FieldErrorKey.dateInFuture;
  if (cycle && (date < cycle.startedAt || (cycle.endedAt !== null && date > cycle.endedAt))) {
    return FieldErrorKey.outsideCycle;
  }
  return null;
}

/**
 * Asking price after the conversion: the one sent, else the price as taxi + the customs paid
 * (null while the taxi had no asking price).
 */
export function convertedListingPrice(
  current: DecimalValue | null,
  conversionTax: DecimalValue,
  requested: DecimalValue | null | undefined,
): number | null {
  if (requested !== null && requested !== undefined) return round2(requested);
  return current === null ? null : sumMoney([current, conversionTax]);
}

/** "Price as private" estimate of a taxi: price as taxi + expected customs (both set), else null. */
export function privatePriceEstimate(v: {
  isTaxi: boolean;
  listingPrice: DecimalValue | null;
  expectedConversionTax: DecimalValue | null;
}): number | null {
  if (!v.isTaxi || v.listingPrice === null || v.expectedConversionTax === null) return null;
  return sumMoney([v.listingPrice, v.expectedConversionTax]);
}

/** Plain-text description of the customs expense (stored once, not translated). */
export function conversionExpenseDescription(oldPlateNo: string, newPlateNo: string): string {
  return `Taxi to private conversion, ${formatPlate(oldPlateNo)} → ${formatPlate(newPlateNo)}`;
}

/** Audit summary of a conversion / correction (both plates). */
export function conversionAuditSummary(
  oldPlateNo: string,
  newPlateNo: string,
  corrected = false,
): string {
  const what = corrected ? 'Corrected taxi to private conversion' : 'Converted taxi to private';
  return `${what}: ${formatPlate(oldPlateNo)} → ${formatPlate(newPlateNo)}`;
}

/** Loads the latest TAXI_TO_PRIVATE change of a vehicle (its old plate = the former taxi plate). */
export const FORMER_TAXI_PLATE_ARGS = {
  where: { reason: 'TAXI_TO_PRIVATE' },
  orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
  take: 1,
  select: { oldPlateNo: true },
} satisfies Prisma.VehiclePlateChangeFindManyArgs;

/** Former taxi plate from the rows loaded with `FORMER_TAXI_PLATE_ARGS` (null = never a taxi). */
export function formerTaxiPlateOf(
  changes: readonly { oldPlateNo: string }[] | null | undefined,
): string | null {
  return changes?.[0]?.oldPlateNo ?? null;
}
