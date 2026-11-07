/**
 * Thin `fetch` wrapper for the Renawi Motors API.
 *
 * - Same-origin `/api` (Vite proxies it in dev, nginx in production); auth lives in httpOnly
 *   cookies, so every request sends `credentials: 'include'` and never touches a token.
 * - Every request carries `X-Requested-With: XMLHttpRequest` (the API's CSRF check).
 * - Errors become a typed `ApiError` built from the API error shape `{ statusCode, message, errors? }`.
 * - On a 401 (except login / refresh / logout) it calls `POST /api/auth/refresh` once (shared by
 *   concurrent requests) and retries the request once. A final 401 calls the unauthorized handler
 *   (the AuthProvider clears the session and the router sends the user to /login).
 */

export const API_BASE = '/api';

/** Error body returned by the API (NestJS exception filter). */
export interface ApiErrorBody {
  statusCode: number;
  /** An i18n key such as `auth.invalidCredentials`, or plain text. */
  message: string | string[];
  /** Field-level details for validation errors. */
  errors?: unknown;
}

/** A failed API call. `status` 0 means the server could not be reached. */
export class ApiError extends Error {
  readonly status: number;
  /** First message of the body (usually an i18n key), or a generic `errors.*` key. */
  readonly messageKey: string;
  readonly errors?: unknown;
  readonly body?: unknown;

  constructor(status: number, messageKey: string, errors?: unknown, body?: unknown) {
    super(messageKey);
    this.name = 'ApiError';
    this.status = status;
    this.messageKey = messageKey;
    this.errors = errors;
    this.body = body;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body (FormData is sent as-is for uploads). */
  body?: unknown;
  query?: Record<string, QueryValue | QueryValue[]>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Do not try `POST /auth/refresh` on a 401. */
  skipRefresh?: boolean;
  /** Do not call the unauthorized handler on a final 401 (the caller handles it). */
  skipUnauthorizedHandler?: boolean;
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler = () => {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
};

/** Replace the default final-401 behaviour (a hard redirect to /login). Returns a reset function. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  const previous = unauthorizedHandler;
  unauthorizedHandler = handler;
  return () => {
    unauthorizedHandler = previous;
  };
}

/** Auth endpoints that must never trigger a refresh (they are the refresh flow themselves). */
const NO_REFRESH_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (v === undefined || v === null || v === '') continue;
      params.append(key, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

/** i18n key describing an HTTP status (used when the body carries no message key). */
export function statusMessageKey(status: number): string {
  if (status === 0) return 'errors.network';
  if (status === 400 || status === 422) return 'errors.validation';
  if (status === 401) return 'errors.unauthorized';
  if (status === 403) return 'errors.forbidden';
  if (status === 404) return 'errors.notFound';
  if (status === 409) return 'errors.conflict';
  if (status === 429) return 'auth.tooManyAttempts';
  if (status >= 500) return 'errors.server';
  return 'errors.generic';
}

function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'message' in body) {
    const b = body as Partial<ApiErrorBody>;
    const message = Array.isArray(b.message) ? b.message[0] : b.message;
    return new ApiError(
      status,
      typeof message === 'string' && message ? message : statusMessageKey(status),
      b.errors,
      body,
    );
  }
  return new ApiError(status, statusMessageKey(status), undefined, body);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, query, headers, signal } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const init: RequestInit = {
    method,
    credentials: 'include',
    signal,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  };
  try {
    return await fetch(buildUrl(path, query), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'errors.network');
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** `POST /auth/refresh`, de-duplicated across concurrent 401s. Resolves true when it worked. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = send('/auth/refresh', { method: 'POST' })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Perform an API request and return the parsed JSON body (undefined for 204). */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  const canRefresh = !options.skipRefresh && !NO_REFRESH_PATHS.some((p) => path.startsWith(p));
  if (res.status === 401 && canRefresh) {
    if (await refreshSession()) res = await send(path, options);
  }

  const body = await parseBody(res);
  if (res.ok) return body as T;

  if (res.status === 401 && canRefresh && !options.skipUnauthorizedHandler) {
    unauthorizedHandler();
  }
  throw toApiError(res.status, body);
}

type BodylessOptions = Omit<RequestOptions, 'method' | 'body'>;

export const http = {
  get: <T>(path: string, options?: BodylessOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: BodylessOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** A field error reported by the API, `path` in dot notation (`businessName.he`). */
export interface ApiFieldError {
  path: string;
  message: string;
}

/**
 * Normalise `ApiError.errors` into field errors. Accepts the shapes a zod-based API produces:
 * `[{ path: ['a', 'b'] | 'a.b', message }]` or `{ 'a.b': message | message[] }`.
 */
export function apiFieldErrors(error: unknown): ApiFieldError[] {
  if (!isApiError(error) || !error.errors) return [];
  const raw = error.errors;
  const out: ApiFieldError[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const { path, message } = item as { path?: unknown; message?: unknown };
      const p = Array.isArray(path) ? path.join('.') : typeof path === 'string' ? path : '';
      if (p && typeof message === 'string') out.push({ path: p, message });
    }
  } else if (typeof raw === 'object') {
    for (const [path, value] of Object.entries(raw as Record<string, unknown>)) {
      const message = Array.isArray(value) ? value[0] : value;
      if (typeof message === 'string') out.push({ path, message });
    }
  }
  return out;
}
