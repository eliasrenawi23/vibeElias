import Decimal from 'decimal.js';
import { z } from 'zod';
import { stripBidiMarks } from './bidi.js';
import { SortOrder } from './enums.js';
import { msg, withParams } from './messages.js';
import { normalizePlate } from './plate.js';

/* ------------------------------------------------------------------------------------------ */
/* Dates                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in `YYYY-MM-DD` form (e.g. rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Calendar date (`@db.Date` columns) on the wire: `YYYY-MM-DD`. */
export const isoDate = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidDate })
  .trim()
  .refine(isValidIsoDate, { message: msg.invalidDate });

/** Instant (`DateTime` columns) on the wire: ISO 8601 with offset, e.g. `2026-11-07T08:30:00.000Z`. */
export const isoDateTime = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidDateTime })
  .trim()
  .datetime({ offset: true, message: msg.invalidDateTime });

/** Billing period `YYYY-MM` (e.g. `LedgerEntry.rentPeriod`). */
export const yearMonth = z
  .string({ required_error: msg.required })
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: msg.invalidPeriod });

/** Optional calendar date for forms: accepts '' (cleared input) as null. */
export const optionalIsoDate = z.union([isoDate, z.literal('').transform(() => null)]).nullish();

/* ------------------------------------------------------------------------------------------ */
/* Numbers & money                                                                            */
/* ------------------------------------------------------------------------------------------ */

/** Upper bound for amounts (fits `Decimal(12,2)` with room to spare). */
export const MONEY_LIMIT = 1_000_000_000;

/** True when the number has at most 2 decimal places (exact decimal check, no float noise). */
export function hasAtMost2Decimals(value: number): boolean {
  return Number.isFinite(value) && new Decimal(value).decimalPlaces() <= 2;
}

function moneySchema(min: number, inclusive: boolean) {
  const base = z
    .number({ required_error: msg.required, invalid_type_error: msg.invalidAmount })
    .finite({ message: msg.invalidAmount });
  const bounded = inclusive
    ? base.gte(min, { message: withParams(msg.min, { min }) })
    : base.gt(min, { message: msg.positive });
  return bounded
    .lte(MONEY_LIMIT, { message: msg.invalidAmount })
    .refine(hasAtMost2Decimals, { message: msg.invalidAmount });
}

/** Amount in ILS: finite, at most 2 decimals, within +-1e9. Numbers (not strings) on the wire. */
export const money = moneySchema(-MONEY_LIMIT, true);
/** Amount >= 0. */
export const nonNegativeMoney = moneySchema(0, true);
/** Amount > 0 (payments, charges, prices). */
export const positiveMoney = moneySchema(0, false);

/** Percentage 0..100 with at most 2 decimals (VAT rate, commission percent). */
export const percent = z
  .number({ required_error: msg.required, invalid_type_error: msg.invalidPercent })
  .finite({ message: msg.invalidPercent })
  .gte(0, { message: msg.invalidPercent })
  .lte(100, { message: msg.invalidPercent })
  .refine(hasAtMost2Decimals, { message: msg.invalidPercent });

/** Non-negative integer (km, cc, counts). */
export const nonNegativeInt = z
  .number({ required_error: msg.required, invalid_type_error: msg.invalidNumber })
  .int({ message: msg.integer })
  .nonnegative();

/* ------------------------------------------------------------------------------------------ */
/* Text & identifiers                                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Database id (cuid). Lenient: 1-64 url-safe characters. */
export const idString = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidValue })
  .trim()
  .min(1, { message: msg.required })
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, { message: msg.invalidValue });

/** Required trimmed text, 1..max characters. */
export const requiredText = (max = 200) =>
  z.string({ required_error: msg.required }).trim().min(1, { message: msg.required }).max(max);

/** Optional trimmed text; '' (cleared input) becomes null. Output: string | null | undefined. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

/** E-mail, trimmed and lower-cased. */
export const email = z
  .string({ required_error: msg.required })
  .trim()
  .toLowerCase()
  .max(254)
  .email({ message: msg.invalidEmail });

/** Optional e-mail for forms ('' becomes null). */
export const optionalEmail = z.union([email, z.literal('').transform(() => null)]).nullish();

/* ------------------------------------------------------------------------------------------ */
/* Israeli plate, phone and ID numbers                                                        */
/* ------------------------------------------------------------------------------------------ */

/** Licence plate: accepts `12-345-67` / `123 45 678` etc., outputs canonical digits (7-8). */
export const plateNo = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidPlate })
  .transform(normalizePlate)
  .pipe(z.string().regex(/^\d{7,8}$/, { message: msg.invalidPlate }));

const PHONE_JUNK_RE = /[\s\-().]/g;
const NATIONAL_PHONE_RES = [
  /^05\d{8}$/, // mobile 05X-XXXXXXX
  /^07\d{8}$/, // VoIP / non-geographic 07X-XXXXXXX
  /^0[2-489]\d{7}$/, // landline 0X-XXXXXXX
  /^1(599|700|800|801|809)\d{6}$/, // 1-700 / 1-800 style numbers
];

/**
 * Normalise an Israeli phone number to national digits (`0501234567`). Accepts separators and
 * the international prefixes `+972`, `00972`, `972` (with or without the trunk 0). Returns the
 * cleaned input unchanged when it is not recognisable; does not validate.
 */
export function normalizePhone(input: string): string {
  let v = stripBidiMarks(input).trim().replace(PHONE_JUNK_RE, '');
  if (v.startsWith('+972')) v = v.slice(4);
  else if (v.startsWith('00972')) v = v.slice(5);
  else if (v.startsWith('972') && v.length >= 11) v = v.slice(3);
  else return v;
  if (v.startsWith('0')) v = v.slice(1);
  return v.startsWith('1') ? v : `0${v}`;
}

/** True for a valid Israeli mobile / landline / VoIP / 1-800 number (any accepted input form). */
export function isValidIsraeliPhone(input: string): boolean {
  const v = normalizePhone(input);
  return NATIONAL_PHONE_RES.some((re) => re.test(v));
}

/** National digits -> E.164 (`+972501234567`); 1-800 style numbers are returned unchanged. */
export function phoneToE164(input: string): string {
  const v = normalizePhone(input);
  return v.startsWith('0') ? `+972${v.slice(1)}` : v;
}

/** Display form: `050-123-4567`, `02-123-4567`, `1-700-123-456`. */
export function formatPhone(input: string): string {
  const v = normalizePhone(input);
  if (/^0[57]\d{8}$/.test(v)) return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`;
  if (/^0\d{8}$/.test(v)) return `${v.slice(0, 2)}-${v.slice(2, 5)}-${v.slice(5)}`;
  if (/^1\d{9}$/.test(v)) return `${v.slice(0, 1)}-${v.slice(1, 4)}-${v.slice(4, 7)}-${v.slice(7)}`;
  return v;
}

/** Phone: Israeli formats in, canonical national digits out (see `normalizePhone`). */
export const phone = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidPhone })
  .transform(normalizePhone)
  .refine((v) => NATIONAL_PHONE_RES.some((re) => re.test(v)), { message: msg.invalidPhone });

/** Optional phone for forms ('' becomes null). */
export const optionalPhone = z.union([z.literal('').transform(() => null), phone]).nullish();

/**
 * Israeli ID number (Teudat Zehut) check-digit validation. Shorter inputs (5-8 digits) are
 * left-padded with zeros, as printed IDs often omit leading zeros.
 */
export function isValidIsraeliId(input: string): boolean {
  const v = normalizeIdNumber(input);
  if (!/^\d{9}$/.test(v) || v === '000000000') return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(v[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Company / corporation number (Het Pey, Amuta etc.): 9 digits starting with 5. The Registrar
 * of Companies uses the same check digit as ID numbers, so it is validated the same way.
 */
export function isValidCompanyNumber(input: string): boolean {
  const v = normalizeIdNumber(input);
  return /^5\d{8}$/.test(v) && isValidIsraeliId(v);
}

/** Strip separators and left-pad to 9 digits (only for 5-8 digit inputs). */
export function normalizeIdNumber(input: string): string {
  const v = stripBidiMarks(input)
    .trim()
    .replace(/[\s\-./]/g, '');
  return /^\d{5,8}$/.test(v) ? v.padStart(9, '0') : v;
}

/** 'COMPANY' for a valid corporation number, 'PERSON' for a valid ID, otherwise null. */
export function israeliIdKind(input: string): 'PERSON' | 'COMPANY' | null {
  if (isValidCompanyNumber(input)) return 'COMPANY';
  return isValidIsraeliId(input) ? 'PERSON' : null;
}

/** Israeli ID (9 digits, check digit) or company number; outputs the 9-digit canonical form. */
export const idNumber = z
  .string({ required_error: msg.required, invalid_type_error: msg.invalidIdNumber })
  .transform(normalizeIdNumber)
  .refine(isValidIsraeliId, { message: msg.invalidIdNumber });

/** Optional ID number for forms ('' becomes null). */
export const optionalIdNumber = z.union([z.literal('').transform(() => null), idNumber]).nullish();

/* ------------------------------------------------------------------------------------------ */
/* Query-string helpers                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Boolean from a query string: true/false/1/0 (booleans pass through). */
export const queryBool = z.preprocess(
  (v) => {
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return v;
  },
  z.boolean({ invalid_type_error: msg.invalidValue }),
);

/**
 * One-or-many query value: accepts `X`, `X,Y` (comma separated) or a repeated param (`[X, Y]`)
 * and always outputs an array.
 */
export function queryList<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((v) => {
    if (typeof v === 'string') {
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return v;
  }, z.array(item).min(1));
}

/** Search text from a query string (trimmed, 1..100 chars). */
export const querySearch = z.string().trim().min(1).max(100);

/* ------------------------------------------------------------------------------------------ */
/* Pagination                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;

/** `?page=1&pageSize=25&sort=createdAt&order=desc` (coerced from strings). */
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** Field name to sort by; each endpoint whitelists the fields it supports. */
  sort: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_.]*$/, { message: msg.invalidValue })
    .optional(),
  order: SortOrder.default('desc'),
});
export type Pagination = z.infer<typeof pagination>;

/** Paginated list response wrapper: `{ items, total, page, pageSize }`. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

/** TS shape of a paginated response. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
