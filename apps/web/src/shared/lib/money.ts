import {
  formatMoney,
  formatNumber,
  stripBidiMarks,
  toLocale,
  type DecimalValue,
  type FormatMoneyOptions,
} from '@renawi/shared';

/**
 * UI money helpers on top of `@renawi/shared` (ILS only, Latin digits in every language:
 * Arabic uses `ar-IL-u-nu-latn`). In markup render amounts through `<Money>`, which isolates the
 * text in `<bdi dir="ltr">`.
 */

/** Format an ILS amount for an i18next language code (`he`, `ar`, `en`, `en-US`...). */
export function formatAmount(
  amount: DecimalValue,
  language: string | undefined,
  options?: FormatMoneyOptions,
): string {
  return formatMoney(amount, toLocale(language), options);
}

/** Format a plain number (km, counts) with Latin digits for an i18next language code. */
export function formatCount(
  value: number,
  language: string | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  return formatNumber(value, toLocale(language), options);
}

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Replace Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits with Latin digits. */
export function toLatinDigits(text: string): string {
  return text.replace(/[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]/gu, (ch) => {
    const code = ch.charCodeAt(0);
    const zero =
      code >= EXTENDED_ARABIC_INDIC_ZERO ? EXTENDED_ARABIC_INDIC_ZERO : ARABIC_INDIC_ZERO;
    return String(code - zero);
  });
}

/**
 * Parse what a user typed into an amount field: accepts `₪`, `ILS`, thousands separators, bidi
 * marks, the Arabic decimal separator (٫) and Arabic-Indic digits. Returns null when it is not a
 * number. The result is not rounded; schemas enforce the 2-decimal limit.
 */
export function parseAmountInput(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const cleaned = toLatinDigits(stripBidiMarks(String(text)))
    .replace(/₪|ILS|ש"ח|ש״ח/gi, '')
    .replace(/\u{066B}/gu, '.') // Arabic decimal separator
    .replace(/[\s,\u{066C}]/gu, ''); // spaces (incl. NBSP, narrow NBSP) and thousands separators
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
