/**
 * `@db.Date` <-> `YYYY-MM-DD` at the Prisma boundary. Calendar dates are stored as UTC midnight;
 * the API process runs in UTC, so `toISOString().slice(0, 10)` is the calendar date.
 */

/** `YYYY-MM-DD` -> `Date` for a `@db.Date` column. */
export function dbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Optional variant: `undefined` stays undefined (field not provided), `null` clears. */
export function dbDateOpt(iso: string | null | undefined): Date | null | undefined {
  if (iso === undefined) return undefined;
  return iso === null ? null : dbDate(iso);
}

/** `@db.Date` value -> `YYYY-MM-DD`. */
export function isoOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Nullable variant of `isoOf`. */
export function isoOrNull(date: Date | null | undefined): string | null {
  return date ? isoOf(date) : null;
}
