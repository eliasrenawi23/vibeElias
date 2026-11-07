import { antdTheme, type ThemeMode } from '@renawi/brand/tokens';
import { localeDirection, Theme, toLocale, type Locale } from '@renawi/shared';
import { App as AntdApp, ConfigProvider, theme as antdThemes } from 'antd';
import type { Locale as AntdLocale } from 'antd/es/locale';
import arEG from 'antd/locale/ar_EG';
import enUS from 'antd/locale/en_US';
import heIL from 'antd/locale/he_IL';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { readStorage, writeStorage } from '../../shared/lib/storage';

/** localStorage key holding the theme preference (`light` | `dark` | `system`). */
export const THEME_STORAGE_KEY = 'rm.theme';

const ANTD_LOCALES: Readonly<Record<Locale, AntdLocale>> = { he: heIL, ar: arEG, en: enUS };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function getSystemDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

function subscribeSystemDark(onChange: () => void): () => void {
  try {
    const mql = window.matchMedia(DARK_QUERY);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  } catch {
    return () => {};
  }
}

function readStoredTheme(): Theme | null {
  const parsed = Theme.safeParse(readStorage(THEME_STORAGE_KEY));
  return parsed.success ? parsed.data : null;
}

export interface UiContextValue {
  /** What the user chose (`system` follows `prefers-color-scheme`). */
  themePreference: Theme;
  /** The theme actually applied. */
  themeMode: ThemeMode;
  setThemePreference: (preference: Theme) => void;
  locale: Locale;
  direction: 'rtl' | 'ltr';
}

const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}

/**
 * Ant Design configuration: direction + locale from the i18next language, light/dark algorithm
 * with the brand tokens, and `data-theme` on `<html>` for `@renawi/brand/tokens.css`.
 */
export function UiProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const locale = toLocale(i18n.resolvedLanguage ?? i18n.language);
  const direction = localeDirection(locale);

  const [themePreference, setPreference] = useState<Theme>(() => readStoredTheme() ?? 'system');
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, () => false);
  const themeMode: ThemeMode =
    themePreference === 'system' ? (systemDark ? 'dark' : 'light') : themePreference;

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeMode;
    root.style.colorScheme = themeMode;
  }, [themeMode]);

  const setThemePreference = useCallback((preference: Theme) => {
    setPreference(preference);
    writeStorage(THEME_STORAGE_KEY, preference);
  }, []);

  const value = useMemo<UiContextValue>(
    () => ({ themePreference, themeMode, setThemePreference, locale, direction }),
    [themePreference, themeMode, setThemePreference, locale, direction],
  );

  const themeConfig = useMemo(
    () => ({
      ...antdTheme(themeMode),
      algorithm: themeMode === 'dark' ? antdThemes.darkAlgorithm : antdThemes.defaultAlgorithm,
    }),
    [themeMode],
  );

  return (
    <UiContext.Provider value={value}>
      <ConfigProvider direction={direction} locale={ANTD_LOCALES[locale]} theme={themeConfig}>
        <AntdApp className="rm-app">{children}</AntdApp>
      </ConfigProvider>
    </UiContext.Provider>
  );
}
