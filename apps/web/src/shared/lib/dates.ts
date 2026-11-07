import {
  DEFAULT_BUSINESS_TZ,
  formatDate,
  INTL_LOCALE_TAGS,
  isValidIsoDate,
  stripBidiMarks,
  toLocale,
  type Locale,
} from '@renawi/shared';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/he';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

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

const periodFormatCache = new Map<string, Intl.DateTimeFormat>();

/**
 * A billing period `YYYY-MM` (e.g. a rent charge's `rentPeriod`) as a month name and year in
 * the UI language with Latin digits: `November 2026`, `נובמבר 2026`, `نوفمبر 2026`.
 * Anything that is not a valid period is returned unchanged.
 */
export function formatPeriod(period: string, language: string | undefined): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period;
  const tag = INTL_LOCALE_TAGS[toLocale(language)];
  let f = periodFormatCache.get(tag);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: 'long', year: 'numeric' });
    periodFormatCache.set(tag, f);
  }
  const [y, m] = period.split('-').map(Number) as [number, number];
  return stripBidiMarks(f.format(new Date(Date.UTC(y, m - 1, 1))));
}

const dateTimeFormatCache = new Map<string, Intl.DateTimeFormat>();

/**
 * An instant (ISO date-time) as a date and 24-hour time in the business time zone, Latin digits:
 * `05/11/2026, 14:30`. Invalid input is returned unchanged.
 */
export function formatInstant(iso: string, language: string | undefined): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tag = INTL_LOCALE_TAGS[toLocale(language)];
  let f = dateTimeFormatCache.get(tag);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, {
      timeZone: DEFAULT_BUSINESS_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    dateTimeFormatCache.set(tag, f);
  }
  return stripBidiMarks(f.format(date));
}

/** Display format for date-time pickers. */
export const DISPLAY_DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm';

/**
 * A date-time picked in the UI (wall-clock time in the business time zone) to an ISO instant
 * (`2026-11-05T12:30:00.000Z` for 14:30 in Jerusalem in winter). Null when cleared.
 */
export function businessWallTimeToIso(value: Dayjs | null | undefined): string | null {
  if (!value || !value.isValid()) return null;
  return dayjs.tz(value.format('YYYY-MM-DDTHH:mm:ss'), DEFAULT_BUSINESS_TZ).toISOString();
}

/** An ISO instant to a dayjs holding its wall-clock time in the business time zone (for pickers). */
export function isoToBusinessWallTime(iso: string | null | undefined): Dayjs | null {
  if (!iso) return null;
  const d = dayjs(iso);
  if (!d.isValid()) return null;
  // Same wall-clock digits as in Jerusalem, as a local dayjs the picker can display.
  return dayjs(d.tz(DEFAULT_BUSINESS_TZ).format('YYYY-MM-DDTHH:mm:ss'));
}

/** Calendar date of an ISO instant in the business time zone. */
export function instantToBusinessDate(iso: string): string {
  return dayjs(iso).tz(DEFAULT_BUSINESS_TZ).format(ISO_DATE_FORMAT);
}

/**
 * A calendar date picked in the UI as an instant at noon in the business time zone (for
 * date-time columns such as `signedAt` where only the day matters).
 */
export function businessDateToInstant(iso: string): string {
  return dayjs.tz(`${iso}T12:00:00`, DEFAULT_BUSINESS_TZ).toISOString();
}
