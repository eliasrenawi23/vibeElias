import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  LOCALES,
  localeDirection,
  resources,
  toLocale,
} from '@renawi/shared';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { setDayjsLocale } from '../shared/lib/dates';

/** localStorage key holding the chosen UI language. */
export const LANGUAGE_STORAGE_KEY = 'rm.lang';

/** Mirror the UI language on `<html lang dir>` and switch the dayjs locale. */
export function applyDocumentLanguage(language: string | undefined): void {
  const locale = toLocale(language);
  const root = document.documentElement;
  root.lang = locale;
  root.dir = localeDirection(locale);
  setDayjsLocale(locale);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: [DEFAULT_NAMESPACE],
    defaultNS: DEFAULT_NAMESPACE,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    // Hebrew is the default: a stored choice (or ?lng=) wins, otherwise <html lang="he"> from
    // index.html. The browser language is deliberately not consulted.
    detection: {
      order: ['querystring', 'localStorage', 'htmlTag'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
    react: { useSuspense: false },
  });

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language);

export default i18n;
