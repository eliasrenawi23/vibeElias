import type { CookieOptions, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants';

function baseOptions(secure: boolean, path: string): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path };
}

/** Sets `rm_access` (path `/`) and `rm_refresh` (path `/api/auth`), both httpOnly + SameSite=Lax. */
export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  opts: { secure: boolean; accessMaxAgeMs: number; refreshMaxAgeMs: number },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(opts.secure, ACCESS_COOKIE_PATH),
    maxAge: opts.accessMaxAgeMs,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(opts.secure, REFRESH_COOKIE_PATH),
    maxAge: opts.refreshMaxAgeMs,
  });
}

/** Expires both auth cookies (same name + path + flags as when they were set). */
export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions(secure, ACCESS_COOKIE_PATH));
  res.clearCookie(REFRESH_COOKIE, baseOptions(secure, REFRESH_COOKIE_PATH));
}
