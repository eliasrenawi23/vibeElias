import { Prisma } from '@prisma/client';
import { round2, type DecimalValue } from '@renawi/shared';

/**
 * Money helpers at the Prisma boundary. DB columns are `Decimal(12,2)` (`Prisma.Decimal`, a
 * decimal.js instance); calculations use decimal.js; the wire carries numbers with 2 decimals.
 */

export type PrismaDecimal = Prisma.Decimal;

/** True for `Prisma.Decimal` and any other decimal.js-compatible instance. */
export function isDecimal(value: unknown): value is Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return true;
  return (
    typeof value === 'object' && value !== null && Prisma.Decimal.isDecimal(value as Prisma.Decimal)
  );
}

/** Any amount (number, numeric string, Decimal) -> `Prisma.Decimal` rounded half-up to 2 dp. */
export function toDbMoney(value: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(round2(value).toFixed(2));
}

/** Nullable variant of `toDbMoney`. */
export function toDbMoneyOrNull(value: DecimalValue | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : toDbMoney(value);
}

/** `Prisma.Decimal` (or number/string) -> JS number with 2 decimals. */
export function decimalToNumber(value: DecimalValue): number {
  return round2(value);
}

/** Nullable variant of `decimalToNumber`. */
export function decimalToNumberOrNull(value: DecimalValue | null | undefined): number | null {
  return value === null || value === undefined ? null : round2(value);
}
