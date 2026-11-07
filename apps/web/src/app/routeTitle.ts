import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router';
import type { TKey } from '../shared/lib/i18n';

/** `handle` of a route in `router.tsx`. */
export interface RouteHandle {
  /** Page title (`<title>` and the top bar heading). */
  titleKey?: TKey;
}

/** Translated title of the deepest matched route that declares one ('' if none). */
export function useRouteTitle(): string {
  const { t } = useTranslation();
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const key = (matches[i]?.handle as RouteHandle | undefined)?.titleKey;
    if (key) return (t as (k: TKey) => string)(key);
  }
  return '';
}

/** Keep `document.title` = `<page> · <app name>` in the current language. */
export function useDocumentTitle(): void {
  const { t } = useTranslation();
  const title = useRouteTitle();
  const appName = t('app.name');
  useEffect(() => {
    document.title = title ? `${title} · ${appName}` : appName;
  }, [title, appName]);
}
