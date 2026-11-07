import { Prisma } from '@prisma/client';
import { round2 } from '@renawi/shared';
import { isDecimal } from '../../prisma/prisma.decimal';

/**
 * Field names of `@db.Date` columns, read from the Prisma DMMF. Calendar dates leave the API as
 * `YYYY-MM-DD`; every other `Date` (timestamps) as an ISO 8601 instant.
 * (Today no field name is a date-only column in one model and a timestamp in another; if that
 * ever happens the name is treated as a timestamp so no information is lost.)
 */
function collectDateOnlyFields(): Set<string> {
  const dateOnly = new Set<string>();
  const timestamps = new Set<string>();
  for (const model of Prisma.dmmf.datamodel.models) {
    for (const field of model.fields) {
      if (field.type !== 'DateTime') continue;
      const native = field.nativeType as readonly unknown[] | null | undefined;
      (native?.[0] === 'Date' ? dateOnly : timestamps).add(field.name);
    }
  }
  for (const name of timestamps) dateOnly.delete(name);
  return dateOnly;
}

export const DATE_ONLY_FIELDS: ReadonlySet<string> = collectDateOnlyFields();

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

function serializeDate(value: Date, key: string | undefined, dateOnly: ReadonlySet<string>) {
  if (Number.isNaN(value.getTime())) return null;
  const iso = value.toISOString();
  return key !== undefined && dateOnly.has(key) ? iso.slice(0, 10) : iso;
}

/**
 * Converts a response payload to its wire form:
 * - `Prisma.Decimal` (and other decimal.js values) -> number rounded half-up to 2 decimals
 * - `Date` in a date-only field -> `YYYY-MM-DD`; any other `Date` -> ISO instant
 * - `bigint` (raw query counts) -> number
 * Plain objects and arrays are walked recursively; class instances (streams, files) pass through.
 */
export function toWire(
  value: unknown,
  key?: string,
  dateOnly: ReadonlySet<string> = DATE_ONLY_FIELDS,
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return serializeDate(value, key, dateOnly);
  if (isDecimal(value)) return round2(value);
  if (Array.isArray(value)) return value.map((item: unknown) => toWire(item, key, dateOnly));
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = toWire(v, k, dateOnly);
  return out;
}
