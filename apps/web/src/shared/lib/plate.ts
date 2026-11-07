import { formatPlate, isTaxiPlate, isValidPlate, normalizePlate } from '@renawi/shared';
import { toLatinDigits } from './money';

export { formatPlate, isTaxiPlate, isValidPlate, normalizePlate };

/** Canonical plate digits from user input (separators, bidi marks and Arabic-Indic digits removed). */
export function normalizePlateInput(input: string): string {
  return normalizePlate(toLatinDigits(input));
}

/** Display form (`12-345-67` / `123-45-678`) or '' for an empty value. */
export function displayPlate(value: string | null | undefined): string {
  if (!value) return '';
  return formatPlate(normalizePlateInput(value));
}

/** Props for plate inputs: always left-to-right with the numeric keypad on phones. */
export const plateInputProps = {
  dir: 'ltr',
  inputMode: 'numeric',
  autoComplete: 'off',
  spellCheck: false,
} as const;
