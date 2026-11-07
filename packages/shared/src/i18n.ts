import type { Locale } from './enums.js';
import ar from './locales/ar/common.json';
import en from './locales/en/common.json';
import he from './locales/he/common.json';

/** i18next namespace holding all shared UI strings. */
export const DEFAULT_NAMESPACE = 'common';

/** Nested translation object (`{ nav: { vehicles: '...' } }`). */
export interface LocaleTree {
  [key: string]: string | LocaleTree;
}

/**
 * i18next `resources` for react-i18next / the PDF renderer:
 * `i18next.init({ resources, ns: ['common'], defaultNS: 'common' })`.
 *
 * The same files are importable as JSON via `@renawi/shared/locales/<lng>/common.json`; for
 * type-safe keys use `typeof import('@renawi/shared/locales/en/common.json')` (English is the
 * reference; a test guarantees identical keys in he/ar/en).
 */
export const resources: Readonly<Record<Locale, { common: LocaleTree }>> = {
  he: { common: he },
  ar: { common: ar },
  en: { common: en },
};
