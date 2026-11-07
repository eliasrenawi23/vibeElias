import { parseValidationMessage } from '@renawi/shared';
import type { ParseKeys, TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError, statusMessageKey } from './http';

/** A key of the `common` namespace (type-checked against the English locale file). */
export type TKey = ParseKeys<'common'>;

type LooseT = (key: string, options?: Record<string, unknown>) => string;

/**
 * Translate a key that is only known at runtime (API messages, zod messages, enum labels).
 * Messages may carry params (`validation.min::{"min":1}`). Unknown keys fall back to `fallback`
 * (itself a key) or are returned unchanged.
 */
export function translateDynamic(
  t: TFunction<'common'>,
  exists: (key: string) => boolean,
  message: string,
  fallback?: TKey,
): string {
  const { key, params } = parseValidationMessage(message);
  const loose = t as unknown as LooseT;
  if (exists(key)) return loose(key, params);
  return fallback ? loose(fallback) : message;
}

/** Status-based message for errors whose body carries no known i18n key. */
function fallbackKeyFor(error: unknown): TKey {
  return (isApiError(error) ? statusMessageKey(error.status) : 'errors.generic') as TKey;
}

/** Hook: turn any thrown value (usually an `ApiError`) into a translated message. */
export function useErrorMessage(): (error: unknown) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (error: unknown) => {
      const fallback = fallbackKeyFor(error);
      if (isApiError(error)) {
        return translateDynamic(t, (k) => i18n.exists(k), error.messageKey, fallback);
      }
      return (t as unknown as LooseT)(fallback);
    },
    [t, i18n],
  );
}

/** Hook: translate a runtime key (zod / API message) with a fallback. */
export function useDynamicT(): (message: string, fallback?: TKey) => string {
  const { t, i18n } = useTranslation();
  return useCallback(
    (message: string, fallback?: TKey) =>
      translateDynamic(t, (k) => i18n.exists(k), message, fallback),
    [t, i18n],
  );
}
