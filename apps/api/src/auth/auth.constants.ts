/** httpOnly cookie holding the 15-minute access JWT (sent with every request). */
export const ACCESS_COOKIE = 'rm_access';
/** httpOnly cookie holding the 30-day refresh JWT (only sent to `/api/auth/*`). */
export const REFRESH_COOKIE = 'rm_refresh';
export const ACCESS_COOKIE_PATH = '/';
export const REFRESH_COOKIE_PATH = '/api/auth';

/** Metadata keys of `@Public()` and `@Roles()`. */
export const IS_PUBLIC_KEY = 'renawi:isPublic';
export const ROLES_KEY = 'renawi:roles';

/** Name of the `@nestjs/throttler` throttler applied to `POST /auth/login`. */
export const LOGIN_THROTTLER = 'login';
