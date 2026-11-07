import { formatDate, isValidIsoDate, toLocale, type Locale } from '@renawi/shared';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/he';

/**
 * Calendar dates travel as `YYYY-MM-DD` strings; the UI converts to dayjs only for pickers.
 * dayjs locales give month and weekday names; digits stay Latin because the `preParsePostFormat`
 * plugin (which would switch Arabic to Arabic-Indic digits) is deliberately not installed.
 */

export const ISO_DATE_FORMAT = 'YYYY-MM-DD';

/** Display format for date pickers (Israeli day-first order). */
export const DISPLAY_DATE_FORMAT = 'DD/MM/YYYY';

const DAYJS_LOCALES: Readonly<Record<Locale, string>> = { he: 'he', ar: 'ar', en: 'en' };

/** Switch the global dayjs locale (called on every i18next `languageChanged`). */
export function setDayjsLocale(language: string | undefined): void {
  dayjs.locale(DAYJS_LOCALES[toLocale(language)]);
}

/** `YYYY-MM-DD` (or null/'') to dayjs for pickers; invalid input gives null. */
export function isoToDayjs(iso: string | null | undefined): Dayjs | null {
  if (!iso || !isValidIsoDate(iso)) return null;
  // dayjs parses `YYYY-MM-DD` natively as a local calendar date (no time-zone shift).
  return dayjs(iso);
}

/** dayjs from a picker to `YYYY-MM-DD` (null when cleared). */
export function dayjsToIso(value: Dayjs | null | undefined): string | null {
  return value && value.isValid() ? value.format(ISO_DATE_FORMAT) : null;
}

/** Locale-aware display of a calendar date (`07/11/2026`), Latin digits, no bidi marks. */
export function formatIsoDate(iso: string, language: string | undefined): string {
  return isValidIsoDate(iso) ? formatDate(iso, toLocale(language)) : iso;
}
