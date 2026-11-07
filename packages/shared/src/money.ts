import Decimal from 'decimal.js';
import { stripBidiMarks } from './bidi.js';
import type { CommissionMode, Locale } from './enums.js';
import { INTL_LOCALE_TAGS } from './locale.js';

/**
 * Money helpers. Amounts are ILS numbers with at most 2 decimals on the wire; every calculation
 * goes through decimal.js with ROUND_HALF_UP so the API, the web and the PDFs agree to the agora.
 */

/** Isolated decimal.js constructor (does not touch the global Decimal configuration). */
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

/** A decimal.js instance or compatible object such as `Prisma.Decimal`. */
export interface DecimalLike {
  toFixed(decimalPlaces?: number): string;
  toString(): string;
}

/** Amount input accepted by the money helpers: number, numeric string or Decimal instance. */
export type DecimalValue = number | string | DecimalLike;

/** Convert to the internal Decimal (decimal.js accepts Decimal-like instances of any clone). */
function dec(value: DecimalValue): Decimal {
  return new D(value as Decimal.Value);
}

/** Default VAT rate (percent) in Israel since 2025. The live value is `Settings.vatRate`. */
export const DEFAULT_VAT_RATE = 18;

export const CURRENCY = 'ILS';

/** Round half-up to 2 decimals and return a JS number. Accepts numbers, numeric strings, Decimals. */
export function round2(value: DecimalValue): number {
  return dec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/** Sum amounts exactly and round to 2 decimals. */
export function sumMoney(values: Iterable<DecimalValue>): number {
  let total = new D(0);
  for (const v of values) total = total.plus(dec(v));
  return round2(total);
}

export interface FormatMoneyOptions {
  /** Show agorot (default true). `false` rounds to whole shekels. */
  decimals?: boolean;
  /** Remove LRM/RLM marks that `Intl` inserts for he/ar (for CSV/compare). Default false. */
  stripMarks?: boolean;
  /** `'symbol'` (default, `₪`), `'code'` (`ILS`) or `'none'` (plain number). */
  display?: 'symbol' | 'code' | 'none';
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${tag}|${JSON.stringify(options)}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, options);
    formatterCache.set(key, f);
  }
  return f;
}

/**
 * Format an ILS amount for a UI language: he `1,234.50 ₪`, ar `1,234.50 ₪` (Latin digits),
 * en `₪1,234.50`. In HTML wrap the result in `<bdi dir="ltr">`.
 */
export function formatMoney(
  amount: DecimalValue,
  locale: Locale,
  options: FormatMoneyOptions = {},
): string {
  const { decimals = true, stripMarks = false, display = 'symbol' } = options;
  const digits = decimals ? 2 : 0;
  const nfOptions: Intl.NumberFormatOptions =
    display === 'none'
      ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
      : {
          style: 'currency',
          currency: CURRENCY,
          currencyDisplay: display === 'code' ? 'code' : 'narrowSymbol',
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        };
  const value = dec(amount).toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toNumber();
  const out = getFormatter(INTL_LOCALE_TAGS[locale], nfOptions).format(value);
  return stripMarks ? stripBidiMarks(out) : out;
}

/** Format a plain number (km, counts, percentages) with Latin digits for the UI language. */
export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  return stripBidiMarks(getFormatter(INTL_LOCALE_TAGS[locale], options).format(value));
}

/**
 * VAT included in a dealer's margin (Israeli "VAT on the margin" regime):
 * `max(0, sale - purchase) * rate / (100 + rate)`, rounded to 2 decimals. A negative margin owes 0.
 */
export function vatOnMargin(
  sale: DecimalValue,
  purchase: DecimalValue,
  rate: DecimalValue,
): number {
  const r = dec(rate);
  const margin = D.max(dec(sale).minus(dec(purchase)), 0);
  return round2(margin.times(r).div(r.plus(100)));
}

/** VAT contained in a gross (VAT-inclusive) amount: `gross * rate / (100 + rate)`. */
export function vatFromGross(gross: DecimalValue, rate: DecimalValue): number {
  const r = dec(rate);
  return round2(dec(gross).times(r).div(r.plus(100)));
}

/** Net amount of a gross (VAT-inclusive) amount: `gross - vatFromGross(gross)`. */
export function netFromGross(gross: DecimalValue, rate: DecimalValue): number {
  return round2(dec(gross).minus(vatFromGross(gross, rate)));
}

/** Gross amount from a net amount: `net * (100 + rate) / 100`. */
export function grossFromNet(net: DecimalValue, rate: DecimalValue): number {
  return round2(dec(net).times(dec(rate).plus(100)).div(100));
}

/**
 * Prorated monthly rent: `round2(rent * overlapDays / daysInMonth)`. A full month returns the
 * exact rent (no rounding drift); 0 days returns 0.
 */
export function prorate(rent: DecimalValue, overlapDays: number, daysInMonth: number): number {
  if (!Number.isInteger(daysInMonth) || daysInMonth < 28 || daysInMonth > 31) {
    throw new RangeError(`daysInMonth must be 28..31, got ${daysInMonth}`);
  }
  if (!Number.isInteger(overlapDays) || overlapDays < 0 || overlapDays > daysInMonth) {
    throw new RangeError(`overlapDays must be 0..${daysInMonth}, got ${overlapDays}`);
  }
  if (overlapDays === daysInMonth) return round2(rent);
  return round2(dec(rent).times(overlapDays).div(daysInMonth));
}

export interface CommissionResult {
  /** Our commission (revenue of a CONSIGNMENT_SALE). */
  commission: number;
  /** Amount owed to the consignor: `price - commission`. */
  payout: number;
  /** True when the payout is below the agreed minimum net to the consignor. */
  belowMinNet: boolean;
}

/**
 * Consignment commission.
 * - FIXED: `value` ILS.
 * - PERCENT: `price * value / 100`.
 * - SURPLUS: everything above the consignor's minimum net, `max(0, price - minNet)`; `value` is
 *   ignored and `minNet` is required.
 * The commission is clamped to `[0, price]`, so the payout is never negative.
 */
export function computeCommission(
  mode: CommissionMode,
  value: DecimalValue | null | undefined,
  price: DecimalValue,
  minNet?: DecimalValue | null,
): CommissionResult {
  const p = dec(price);
  let commission: Decimal;
  switch (mode) {
    case 'FIXED':
      commission = dec(value ?? 0);
      break;
    case 'PERCENT':
      commission = p.times(dec(value ?? 0)).div(100);
      break;
    case 'SURPLUS':
      if (minNet === null || minNet === undefined) {
        throw new RangeError('SURPLUS commission requires minNet');
      }
      commission = p.minus(dec(minNet));
      break;
    default: {
      const exhaustive: never = mode;
      throw new RangeError(`Unknown commission mode ${String(exhaustive)}`);
    }
  }
  commission = D.min(D.max(commission, 0), p).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const payout = p.minus(commission);
  const belowMinNet = minNet !== null && minNet !== undefined && payout.lessThan(dec(minNet));
  return { commission: round2(commission), payout: round2(payout), belowMinNet };
}
