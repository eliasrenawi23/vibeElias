import { stripBidiMarks } from './bidi.js';

/**
 * Israeli licence plates. Canonical form is digits only (7 digits for older cars, 8 for cars
 * registered since 2017). Display forms: `12-345-67` (7) and `123-45-678` (8).
 */

/** Characters accepted as separators when typing a plate. */
const PLATE_SEPARATORS = /[\s\-._/\u2010-\u2015]/g;
const PLATE_DIGITS = /^\d{7,8}$/;

/** Strip separators (spaces, dashes, dots, slashes) and bidi marks. Does not validate. */
export function normalizePlate(input: string): string {
  return stripBidiMarks(input).replace(PLATE_SEPARATORS, '');
}

/** True for a 7- or 8-digit plate (after normalisation). */
export function isValidPlate(input: string): boolean {
  return PLATE_DIGITS.test(normalizePlate(input));
}

/** Format canonical digits for display. Unknown lengths are returned normalised but unformatted. */
export function formatPlate(digits: string): string {
  const d = normalizePlate(digits);
  if (!/^\d+$/.test(d)) return d;
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
  return d;
}

/**
 * Validation hint: Israeli taxi plates end in 25 or 26. Used to suggest `isTaxi`, never to block.
 */
export function isTaxiPlate(digits: string): boolean {
  const d = normalizePlate(digits);
  return PLATE_DIGITS.test(d) && (d.endsWith('25') || d.endsWith('26'));
}
