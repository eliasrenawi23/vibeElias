import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import type { Locale } from './enums.js';
import { DEFAULT_BUSINESS_TZ, INTL_LOCALE_TAGS } from './locale.js';
import { isValidIsoDate } from './primitives.js';
import { stripBidiMarks } from './bidi.js';

dayjs.extend(utc);

/**
 * Calendar-date helpers. Calendar dates are `YYYY-MM-DD` strings everywhere (`@db.Date` columns,
 * wire format); all arithmetic is done in UTC so results never depend on the host time zone.
 * Ranges are inclusive on both ends unless stated otherwise; `null` as a range end = open-ended.
 */

const ISO = 'YYYY-MM-DD';

function parse(iso: string): Dayjs {
  if (!isValidIsoDate(iso)) throw new RangeError(`Invalid ISO date: ${iso}`);
  return dayjs.utc(iso);
}

function fmt(d: Dayjs): string {
  return d.format(ISO);
}

/** Today's calendar date in the business time zone (default Asia/Jerusalem). */
export function todayInBusinessTz(
  tz: string = DEFAULT_BUSINESS_TZ,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Calendar date of a JS Date / ISO instant in the given time zone. */
export function toBusinessDate(instant: Date | string, tz: string = DEFAULT_BUSINESS_TZ): string {
  return todayInBusinessTz(tz, typeof instant === 'string' ? new Date(instant) : instant);
}

/** `iso + n` days (n may be negative). */
export function addDays(iso: string, n: number): string {
  return fmt(parse(iso).add(n, 'day'));
}

/** `iso + n` months, clamped to the end of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: string, n: number): string {
  return fmt(parse(iso).add(n, 'month'));
}

/** Whole days from `a` to `b` (`b - a`); negative when `b` is earlier. */
export function diffDays(a: string, b: string): number {
  return parse(b).diff(parse(a), 'day');
}

/** Compare two ISO dates: -1, 0 or 1. */
export function compareIsoDates(a: string, b: string): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Latest of the given dates. */
export function maxIsoDate(...dates: string[]): string {
  return dates.reduce((m, d) => (d > m ? d : m));
}

/** Earliest of the given dates. */
export function minIsoDate(...dates: string[]): string {
  return dates.reduce((m, d) => (d < m ? d : m));
}

/** `YYYY-MM` period of a date. */
export function periodOf(iso: string): string {
  return fmt(parse(iso)).slice(0, 7);
}

/** First day of a `YYYY-MM` period. */
export function periodStart(period: string): string {
  return fmt(parse(`${period}-01`));
}

/** Last day of a `YYYY-MM` period. */
export function periodEnd(period: string): string {
  return fmt(parse(`${period}-01`).endOf('month'));
}

/** Number of days in the month of a date or a `YYYY-MM` period. */
export function daysInMonth(isoOrPeriod: string): number {
  const iso = isoOrPeriod.length === 7 ? `${isoOrPeriod}-01` : isoOrPeriod;
  return parse(iso).daysInMonth();
}

/** `YYYY-MM` + n months. */
export function addPeriods(period: string, n: number): string {
  return fmt(parse(`${period}-01`).add(n, 'month')).slice(0, 7);
}

/**
 * Billing periods touched by a date range, inclusive: `monthsBetween('2026-01-16', '2026-03-02')`
 * -> `['2026-01', '2026-02', '2026-03']`. Accepts dates or `YYYY-MM` periods. Empty if from > to.
 */
export function monthsBetween(from: string, to: string): string[] {
  const start = from.length === 7 ? from : periodOf(from);
  const end = to.length === 7 ? to : periodOf(to);
  const out: string[] = [];
  for (let p = start; p <= end; p = addPeriods(p, 1)) out.push(p);
  return out;
}

/**
 * Whole calendar months elapsed from `from` to `to` (e.g. 2026-01-15 -> 2026-02-14 = 0,
 * -> 2026-02-15 = 1). Used for the dealer-registration 12-month cap.
 */
export function wholeMonthsBetween(from: string, to: string): number {
  return parse(to).diff(parse(from), 'month');
}

/**
 * Number of days in the intersection of two inclusive ranges `[a1, a2]` and `[b1, b2]`.
 * A `null`/`undefined` end means open-ended. Returns 0 when the ranges do not overlap.
 */
export function overlapDays(
  a1: string,
  a2: string | null | undefined,
  b1: string,
  b2: string | null | undefined,
): number {
  const start = maxIsoDate(a1, b1);
  const ends = [a2, b2].filter((d): d is string => typeof d === 'string');
  if (ends.length === 0) throw new RangeError('overlapDays needs at least one closed range end');
  const end = minIsoDate(...ends);
  if (start > end) return 0;
  return diffDays(start, end) + 1;
}

/** Days of a `YYYY-MM` period covered by the inclusive range `[from, to]` (`to` null = open). */
export function overlapDaysInPeriod(
  period: string,
  from: string,
  to: string | null | undefined,
): number {
  return overlapDays(periodStart(period), periodEnd(period), from, to);
}

/**
 * `dueDate` of a rent period: the contract `paymentDay` (1..28) clamped to the month length.
 */
export function dueDateInPeriod(period: string, paymentDay: number): string {
  const day = Math.min(Math.max(1, Math.trunc(paymentDay)), daysInMonth(period));
  return `${period}-${String(day).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Working days (Israel)                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Israeli working week: Sunday-Thursday (Friday and Saturday off).
 * Public holidays (Rosh Hashana, Pesach, etc.) are NOT taken into account; deadlines computed
 * here may therefore be up to a few days earlier than the legal deadline around holidays.
 */
export function isWorkingDay(iso: string): boolean {
  const dow = parse(iso).day(); // 0 = Sunday ... 6 = Saturday
  return dow >= 0 && dow <= 4;
}

/**
 * The date `n` working days after `dateIso` (the start day itself is not counted).
 * `n = 0` returns the date unchanged. Negative `n` counts backwards. Holidays are ignored.
 * Example: sale on Thursday 2026-11-05 + 6 working days -> Sunday 2026-11-15.
 */
export function addWorkingDays(dateIso: string, n: number): string {
  let d = parse(dateIso);
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(Math.trunc(n));
  while (left > 0) {
    d = d.add(step, 'day');
    if (isWorkingDay(fmt(d))) left--;
  }
  return fmt(d);
}

/** Alias used by the deal transfer rule (`transferDueAt = workingDaysAfter(saleDate, 6)`). */
export const workingDaysAfter = addWorkingDays;

/** Working days the buyer must be registered within after a sale (Car Services Law s.93(b)). */
export const TRANSFER_DUE_WORKING_DAYS = 6;

/* ------------------------------------------------------------------------------------------ */
/* Taxi & dealer rules                                                                        */
/* ------------------------------------------------------------------------------------------ */

/** From this age (years) a taxi needs a semi-annual (6-monthly) vehicle test. */
export const TAXI_SEMI_ANNUAL_TEST_AGE = 10;
/** A taxi licence cannot be assigned to a vehicle of this age (years) or older. */
export const TAXI_MAX_AGE = 12;
/** Warning threshold before the age limit, in months (11.5 years). */
export const TAXI_NEAR_LIMIT_MONTHS = 138;

export interface TaxiAgeStatus {
  /** Calendar-year age: `todayYear - manufactureYear`. */
  ageYears: number;
  /** Semi-annual test required (age >= 10). */
  semiAnnualTest: boolean;
  /** Too old to operate as a taxi (age >= 12): block licence assignment. */
  blocked: boolean;
  /** Within the last half year before the limit (age >= 11.5, not yet blocked). */
  nearLimit: boolean;
  /** First date with the semi-annual test regime. */
  semiAnnualFrom: string;
  /** First date the vehicle is blocked. */
  blockedFrom: string;
}

/**
 * Taxi age rules from the manufacture year. Only the year is known, so age is counted from
 * 1 January of the manufacture year (calendar-year rule) - verify edge cases with the MoT.
 */
export function taxiAgeStatus(year: number, today: string): TaxiAgeStatus {
  const t = parse(today);
  const ageYears = t.year() - year;
  const start = `${year}-01-01`;
  const semiAnnualFrom = `${year + TAXI_SEMI_ANNUAL_TEST_AGE}-01-01`;
  const blockedFrom = `${year + TAXI_MAX_AGE}-01-01`;
  const nearFrom = addMonths(start, TAXI_NEAR_LIMIT_MONTHS);
  const blocked = today >= blockedFrom;
  return {
    ageYears,
    semiAnnualTest: today >= semiAnnualFrom,
    blocked,
    nearLimit: !blocked && today >= nearFrom,
    semiAnnualFrom,
    blockedFrom,
  };
}

/** A dealer may keep a car registered as "dealer-owned" for at most this many months. */
export const DEALER_REGISTRATION_MAX_MONTHS = 12;
/** Alert threshold (months) for the dealer-registration cap. */
export const DEALER_REGISTRATION_ALERT_MONTHS = 11;

export interface DealerRegistrationStatus {
  monthsElapsed: number;
  /** >= 11 months: transfer out or sell soon. */
  alert: boolean;
  /** >= 12 months: the dealer now counts as a "hand". */
  expired: boolean;
  /** Date the 12-month cap is reached. */
  expiresAt: string;
}

/** Status of the 12-month dealer-registration cap (since 2023). */
export function dealerRegistrationStatus(
  dealerRegisteredAt: string,
  today: string,
): DealerRegistrationStatus {
  const monthsElapsed = wholeMonthsBetween(dealerRegisteredAt, today);
  return {
    monthsElapsed,
    alert: monthsElapsed >= DEALER_REGISTRATION_ALERT_MONTHS,
    expired: monthsElapsed >= DEALER_REGISTRATION_MAX_MONTHS,
    expiresAt: addMonths(dealerRegisteredAt, DEALER_REGISTRATION_MAX_MONTHS),
  };
}

/** Days within which a traffic fine must be reassigned to the actual driver. */
export const FINE_REASSIGN_DAYS = 90;

/** Default reassignment deadline of a fine: `receivedAt + 90 days`. */
export function fineReassignDeadline(receivedAt: string): string {
  return addDays(receivedAt, FINE_REASSIGN_DAYS);
}

/** Default annual taxi-licence fee due date: 31 December of the given year. */
export function annualFeeDueDate(year: number): string {
  return `${year}-12-31`;
}

/* ------------------------------------------------------------------------------------------ */
/* Display                                                                                    */
/* ------------------------------------------------------------------------------------------ */

const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Format a calendar date for display with Latin digits: he `07.11.2026`, ar `07/11/2026`,
 * en `07/11/2026`. Bidi marks inserted by `Intl` are removed.
 */
export function formatDate(iso: string, locale: Locale): string {
  const tag = INTL_LOCALE_TAGS[locale];
  let f = dateFormatCache.get(tag);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    dateFormatCache.set(tag, f);
  }
  return stripBidiMarks(f.format(parse(iso).toDate()));
}
