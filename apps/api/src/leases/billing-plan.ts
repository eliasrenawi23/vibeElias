import type { LeaseContract, LeaseSegment } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  addDays,
  daysInMonth,
  diffDays,
  dueDateInPeriod,
  maxIsoDate,
  minIsoDate,
  monthsBetween,
  periodEnd,
  periodOf,
  periodStart,
  prorate,
  round2,
  type DecimalValue,
  type LeaseType,
} from '@renawi/shared';
import { isoOf, isoOrNull } from '../common/dates';

/*
 * Pure rent-billing rules (plan, "Ledger design"). No database access: the billing service
 * loads contracts / segments / existing charges and persists what these functions return.
 *
 * - Billing unit = segment x calendar month (`rentPeriod = 'YYYY-MM'`).
 * - Days billed = overlap of the month, the segment and the contract's active range
 *   `[startDate, actualEndDate ?? endDate]`; `amount = round2(rent x days / daysInMonth)`, a full
 *   month is the exact rent. When several segments share a month (car swap / rent change), the
 *   later lines absorb the rounding so the lines sum to `round2` of the exact total (two halves
 *   of one rent always add up to the rent).
 * - `date = max(monthStart, segment start)`; `dueDate` = `paymentDay` clamped into the month,
 *   never before `date`.
 */

/** decimal.js clone with half-up rounding (independent of the global configuration). */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

function dec(value: DecimalValue): Decimal {
  return new D(value.toString());
}

export interface BillingContract {
  type: LeaseType;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  paymentDay: number;
}

export interface BillingSegment {
  id: string;
  taxiLicenseId: string;
  vehicleId: string | null;
  monthlyRent: DecimalValue;
  startDate: string;
  endDate: string | null;
}

export interface PlannedRentCharge {
  segmentId: string;
  rentPeriod: string;
  /** First billed day (`max(monthStart, segment start)`). */
  date: string;
  /** Last billed day of this line. */
  to: string;
  dueDate: string;
  /** Billed days. */
  days: number;
  amount: number;
  /** Income attribution: our car on CAR_AND_NUMBER leases (NUMBER_ONLY rent is licence income). */
  vehicleId: string | null;
  taxiLicenseId: string;
}

/** Billing view of a contract row. */
export function toBillingContract(c: LeaseContract): BillingContract {
  return {
    type: c.type,
    startDate: isoOf(c.startDate),
    endDate: isoOf(c.endDate),
    actualEndDate: isoOrNull(c.actualEndDate),
    paymentDay: c.paymentDay,
  };
}

/** Billing view of segment rows. */
export function toBillingSegments(segments: readonly LeaseSegment[]): BillingSegment[] {
  return segments.map((s) => ({
    id: s.id,
    taxiLicenseId: s.taxiLicenseId,
    vehicleId: s.vehicleId,
    monthlyRent: s.monthlyRent,
    startDate: isoOf(s.startDate),
    endDate: isoOrNull(s.endDate),
  }));
}

/** Last billable day of a contract: the actual end when it ended early, else the contract end. */
export function billingEnd(contract: Pick<BillingContract, 'endDate' | 'actualEndDate'>): string {
  return contract.actualEndDate ?? contract.endDate;
}

/** Due date of a rent line: `paymentDay` clamped into the month, never before the line's date. */
export function rentDueDate(period: string, paymentDay: number, date: string): string {
  return maxIsoDate(dueDateInPeriod(period, paymentDay), date);
}

function bySegmentStart(a: BillingSegment, b: BillingSegment): number {
  return a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id);
}

/** Rent lines of one month (empty when the month is outside the contract's active range). */
export function planRentPeriod(
  contract: BillingContract,
  segments: readonly BillingSegment[],
  period: string,
): PlannedRentCharge[] {
  const from0 = maxIsoDate(periodStart(period), contract.startDate);
  const to0 = minIsoDate(periodEnd(period), billingEnd(contract));
  if (from0 > to0) return [];
  const monthDays = daysInMonth(period);
  const out: PlannedRentCharge[] = [];
  let exactTotal = new D(0);
  let billedTotal = new D(0);
  for (const seg of [...segments].sort(bySegmentStart)) {
    const from = maxIsoDate(from0, seg.startDate);
    const to = seg.endDate ? minIsoDate(to0, seg.endDate) : to0;
    if (from > to) continue;
    const days = diffDays(from, to) + 1;
    // First line of the month = prorate(); later lines take the cumulative rounding remainder.
    const amount =
      out.length === 0
        ? dec(prorate(seg.monthlyRent, days, monthDays))
        : exactTotal
            .plus(dec(seg.monthlyRent).times(days).div(monthDays))
            .toDecimalPlaces(2)
            .minus(billedTotal);
    exactTotal = exactTotal.plus(dec(seg.monthlyRent).times(days).div(monthDays));
    billedTotal = billedTotal.plus(amount);
    if (amount.lte(0)) continue;
    out.push({
      segmentId: seg.id,
      rentPeriod: period,
      date: from,
      to,
      dueDate: rentDueDate(period, contract.paymentDay, from),
      days,
      amount: round2(amount),
      vehicleId: contract.type === 'CAR_AND_NUMBER' ? seg.vehicleId : null,
      taxiLicenseId: seg.taxiLicenseId,
    });
  }
  return out;
}

/** Billing months of a contract between two periods (inclusive), clipped to its active range. */
export function billingPeriods(contract: BillingContract, from: string, upto: string): string[] {
  const first = maxIsoDate(`${from}-01`, `${periodOf(contract.startDate)}-01`).slice(0, 7);
  const last = minIsoDate(`${upto}-01`, `${periodOf(billingEnd(contract))}-01`).slice(0, 7);
  return monthsBetween(first, last);
}

/** Every rent line of a contract from its first month up to `upto` (inclusive). */
export function planRentCharges(
  contract: BillingContract,
  segments: readonly BillingSegment[],
  upto: string,
  from: string = periodOf(contract.startDate),
): PlannedRentCharge[] {
  return billingPeriods(contract, from, upto).flatMap((p) => planRentPeriod(contract, segments, p));
}

/** An existing (non-voided) RENT charge as seen by the planning functions. */
export interface ExistingRentCharge {
  id: string;
  segmentId: string | null;
  rentPeriod: string;
  amount: DecimalValue;
}

export interface RebillPlan {
  /** Existing charges that no longer match the plan (to be voided). */
  voidIds: string[];
  /** Planned lines without a matching existing charge (to be inserted). */
  create: PlannedRentCharge[];
}

/**
 * Re-bills the given months: an existing charge is kept when a planned line has the same segment
 * and amount; every other existing charge is voided and the unmatched planned lines created.
 */
export function planRebill(
  contract: BillingContract,
  segments: readonly BillingSegment[],
  periods: readonly string[],
  existing: readonly ExistingRentCharge[],
): RebillPlan {
  const voidIds: string[] = [];
  const create: PlannedRentCharge[] = [];
  for (const period of periods) {
    const planned = planRentPeriod(contract, segments, period);
    const current = existing.filter((e) => e.rentPeriod === period);
    const unmatched = [...planned];
    for (const e of current) {
      const i = unmatched.findIndex(
        (p) => p.segmentId === e.segmentId && dec(p.amount).equals(dec(e.amount)),
      );
      if (i >= 0) unmatched.splice(i, 1);
      else voidIds.push(e.id);
    }
    create.push(...unmatched);
  }
  return { voidIds, create };
}

export interface UnusedRentCredit {
  rentPeriod: string;
  /** First unused day. */
  from: string;
  /** Last day of the month. */
  to: string;
  amount: number;
}

/**
 * Credits for charged rent after an early end: per month from the end month on, what was
 * charged minus what the shortened contract would have been charged. `contract` and
 * `segments` already carry the new `actualEndDate` / closed segment.
 */
export function unusedRentCredits(
  contract: BillingContract,
  segments: readonly BillingSegment[],
  existing: readonly ExistingRentCharge[],
): UnusedRentCredit[] {
  const end = billingEnd(contract);
  const endPeriod = periodOf(end);
  const charged = new Map<string, Decimal>();
  for (const e of existing) {
    if (e.rentPeriod < endPeriod) continue;
    charged.set(e.rentPeriod, (charged.get(e.rentPeriod) ?? new D(0)).plus(dec(e.amount)));
  }
  const out: UnusedRentCredit[] = [];
  for (const [rentPeriod, total] of [...charged.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const due = planRentPeriod(contract, segments, rentPeriod).reduce(
      (sum, p) => sum.plus(p.amount),
      new D(0),
    );
    const credit = total.minus(due);
    if (credit.lte(0)) continue;
    out.push({
      rentPeriod,
      from: maxIsoDate(addDays(end, 1), periodStart(rentPeriod)),
      to: periodEnd(rentPeriod),
      amount: round2(credit),
    });
  }
  return out;
}

/** Early-exit penalty: `round2(months x monthly rent)` (0 when months is 0). */
export function penaltyAmount(months: DecimalValue, monthlyRent: DecimalValue): number {
  return round2(dec(months).times(dec(monthlyRent)));
}

/** Deposit applied to debt: `min(held, balance)`, never negative. */
export function depositApplyAmount(held: DecimalValue, balance: DecimalValue): number {
  const amount = D.min(dec(held), dec(balance));
  return amount.gt(0) ? round2(amount) : 0;
}
