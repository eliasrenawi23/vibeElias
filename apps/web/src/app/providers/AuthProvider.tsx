import { toLocale, type AuthUser, type Locale, type Login, type Theme } from '@renawi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  updateMe,
} from '../../features/auth/api';
import { authKeys } from '../../features/auth/queryKeys';
import { isApiError, setUnauthorizedHandler } from '../../shared/lib/http';
import { readJsonStorage, writeStorage } from '../../shared/lib/storage';
import { useUi } from './UiProvider';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

/** User preferences stored on the account (`PATCH /auth/me`). */
export interface Preferences {
  locale?: Locale;
  theme?: Theme;
}

/**
 * Choices made while logged out (e.g. the language menu on the login page). They win over the
 * account's saved values at the next login and are then saved to the account.
 */
const PENDING_PREFS_KEY = 'rm.pendingPrefs';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Error of the session check when the API is unreachable (status `error`). */
  error: unknown;
  /** True after a request failed with 401 and the refresh did not help. */
  sessionExpired: boolean;
  retry: () => void;
  login: (body: Login) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Apply language / theme now and remember them (on the account when logged in). */
  setPreferences: (prefs: Preferences) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Language / theme setter that works with or without an `AuthProvider` (the language menu is
 * also used on the login page and in isolated component tests).
 */
export function usePreferences(): (prefs: Preferences) => void {
  const ctx = useContext(AuthContext);
  const { i18n } = useTranslation();
  const { setThemePreference } = useUi();
  const local = useCallback(
    (prefs: Preferences) => {
      if (prefs.locale) void i18n.changeLanguage(prefs.locale);
      if (prefs.theme) setThemePreference(prefs.theme);
    },
    [i18n, setThemePreference],
  );
  return ctx?.setPreferences ?? local;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const { setThemePreference } = useUi();
  const [sessionExpired, setSessionExpired] = useState(false);
  /** Id of the user whose saved preferences have been applied in this tab. */
  const appliedFor = useRef<string | null>(null);

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: Infinity,
    retry: (failureCount, error) =>
      isApiError(error) && error.isNetworkError ? failureCount < 2 : false,
  });

  const applyLocally = useCallback(
    (prefs: Preferences) => {
      if (prefs.locale && toLocale(i18n.resolvedLanguage) !== prefs.locale) {
        void i18n.changeLanguage(prefs.locale);
      }
      if (prefs.theme) setThemePreference(prefs.theme);
    },
    [i18n, setThemePreference],
  );

  // Session restored on boot: the account's saved preferences win (once per user and tab).
  const user = meQuery.data ?? null;
  useEffect(() => {
    if (!user) {
      appliedFor.current = null;
      return;
    }
    if (appliedFor.current === user.id) return;
    appliedFor.current = user.id;
    applyLocally({ locale: user.locale, theme: user.theme });
  }, [user, applyLocally]);

  // A final 401 anywhere ends the session; RequireAuth then redirects to /login.
  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        if (queryClient.getQueryData(authKeys.me())) setSessionExpired(true);
        queryClient.setQueryData(authKeys.me(), null);
      }),
    [queryClient],
  );

  const login = useCallback(
    async (body: Login) => {
      let signedIn = await loginRequest(body);
      const pending = readJsonStorage<Preferences>(PENDING_PREFS_KEY) ?? {};
      writeStorage(PENDING_PREFS_KEY, null);
      const wanted = {
        locale: pending.locale ?? signedIn.locale,
        theme: pending.theme ?? signedIn.theme,
      };
      appliedFor.current = signedIn.id;
      applyLocally(wanted);
      if (wanted.locale !== signedIn.locale || wanted.theme !== signedIn.theme) {
        try {
          signedIn = await updateMe(wanted);
        } catch {
          // Saving the preference is best-effort; the local choice stays applied.
        }
      }
      setSessionExpired(false);
      queryClient.setQueryData(authKeys.me(), signedIn);
      return signedIn;
    },
    [applyLocally, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Even if the API is unreachable the local session is cleared.
    }
    appliedFor.current = null;
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== authKeys.all[0] });
    queryClient.setQueryData(authKeys.me(), null);
  }, [queryClient]);

  const setPreferences = useCallback(
    (prefs: Preferences) => {
      applyLocally(prefs);
      const current = queryClient.getQueryData<AuthUser | null>(authKeys.me());
      if (current) {
        updateMe(prefs)
          .then((updated) => queryClient.setQueryData(authKeys.me(), updated))
          .catch(() => {
            // Best-effort: the preference still applies in this browser.
          });
      } else {
        const pending = readJsonStorage<Preferences>(PENDING_PREFS_KEY) ?? {};
        writeStorage(PENDING_PREFS_KEY, JSON.stringify({ ...pending, ...prefs }));
      }
    },
    [applyLocally, queryClient],
  );

  const { refetch } = meQuery;
  const retry = useCallback(() => void refetch(), [refetch]);

  const status: AuthStatus = meQuery.isPending
    ? 'loading'
    : meQuery.isError && meQuery.data === undefined
      ? 'error'
      : user
        ? 'authenticated'
        : 'anonymous';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error: meQuery.error,
      sessionExpired,
      retry,
      login,
      logout,
      setPreferences,
    }),
    [user, status, meQuery.error, sessionExpired, retry, login, logout, setPreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
