import type { AuthUser } from '@renawi/shared';

/** `req.user` after `JwtAuthGuard`: the public user plus the token version it was checked against. */
export interface AuthenticatedUser extends AuthUser {
  tokenVersion: number;
}

/** Claims of the access JWT (`rm_access`). */
export interface AccessTokenPayload {
  sub: string;
  /** `User.tokenVersion` at issue time; a mismatch means logged out / password changed. */
  tv: number;
  typ: 'access';
  iat?: number;
  exp?: number;
}

/** Claims of the refresh JWT (`rm_refresh`). */
export interface RefreshTokenPayload {
  sub: string;
  tv: number;
  typ: 'refresh';
  /** Unique id; each refresh token can be used exactly once (rotation). */
  jti: string;
  iat?: number;
  exp?: number;
}

/** Result of login / refresh: the public user plus freshly signed tokens for the cookies. */
export interface IssuedSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
