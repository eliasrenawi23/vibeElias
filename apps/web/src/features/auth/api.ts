import type { AuthSession, AuthUser, Login, MeUpdate } from '@renawi/shared';
import { http, isApiError } from '../../shared/lib/http';

/**
 * Auth endpoints. Tokens travel only in httpOnly cookies set by the API; the client never reads
 * them. Every call returns `{ user }`.
 */

export async function login(body: Login): Promise<AuthUser> {
  const { user } = await http.post<AuthSession>('/auth/login', body);
  return user;
}

export async function logout(): Promise<void> {
  await http.post<void>('/auth/logout');
}

/**
 * Current session, or null when not logged in. A 401 first goes through the refresh flow in
 * `http.ts` (so an expired access token with a valid refresh cookie still restores the session).
 */
export async function fetchMe(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const { user } = await http.get<AuthSession>('/auth/me', {
      signal,
      skipUnauthorizedHandler: true,
    });
    return user;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

export async function updateMe(body: MeUpdate): Promise<AuthUser> {
  const { user } = await http.patch<AuthSession>('/auth/me', body);
  return user;
}
