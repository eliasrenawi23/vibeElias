import { Locale } from './enums.js';

/** Supported UI languages, in menu order. */
export const LOCALES: readonly Locale[] = Locale.options;

/** Default UI / document language. */
export const DEFAULT_LOCALE: Locale = 'he';

/** Business time zone (calendar "today", billing runs, cron). */
export const DEFAULT_BUSINESS_TZ = 'Asia/Jerusalem';

/**
 * BCP 47 tags passed to `Intl`. Arabic forces Latin digits (`-u-nu-latn`) app-wide; all three
 * use the Israeli region so the currency is ILS-native.
 */
export const INTL_LOCALE_TAGS: Readonly<Record<Locale, string>> = {
  he: 'he-IL',
  ar: 'ar-IL-u-nu-latn',
  en: 'en-IL',
};

/** Text direction of a UI language. */
export function localeDirection(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'en' ? 'ltr' : 'rtl';
}

/** True for right-to-left languages (he, ar). */
export function isRtlLocale(locale: Locale): boolean {
  return localeDirection(locale) === 'rtl';
}

/** Coerce any string (e.g. `navigator.language`, `Accept-Language`, DB value) to a supported locale. */
export function toLocale(
  value: string | null | undefined,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (!value) return fallback;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  if (base === 'iw') return 'he';
  const parsed = Locale.safeParse(base);
  return parsed.success ? parsed.data : fallback;
}
