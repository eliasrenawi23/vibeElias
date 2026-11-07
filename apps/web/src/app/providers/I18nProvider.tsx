import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

/**
 * Provides the i18next instance. `../i18n` initialises it (resources from `@renawi/shared`,
 * he/ar/en, Hebrew default) and keeps `<html lang dir>` + the dayjs locale in sync on every
 * `languageChanged`; AntD direction/locale follow in `UiProvider`.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
