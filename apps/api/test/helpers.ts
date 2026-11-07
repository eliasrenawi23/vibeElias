import { addDays, DEFAULT_BUSINESS_TZ, todayInBusinessTz } from '@renawi/shared';
import request from 'supertest';
import type { Response } from 'supertest';
import {
  accessCookie,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  TestApp,
  XHR,
} from './utils';

/** Authenticated request helpers (mutations carry X-Requested-With). */
export interface Api {
  get(url: string): request.Test;
  post(url: string): request.Test;
  patch(url: string): request.Test;
  del(url: string): request.Test;
}

export function api(t: TestApp, cookie: string): Api {
  return {
    get: (url) => request(t.http).get(url).set('Cookie', cookie),
    post: (url) => request(t.http).post(url).set(XHR).set('Cookie', cookie),
    patch: (url) => request(t.http).patch(url).set(XHR).set('Cookie', cookie),
    del: (url) => request(t.http).delete(url).set(XHR).set('Cookie', cookie),
  };
}

export interface Session {
  t: TestApp;
  api: Api;
  cookie: string;
  userId: string;
}

/** Boots the app on an empty test database with one logged-in ADMIN. */
export async function startSession(): Promise<Session> {
  const t = await createTestApp();
  await resetDatabase(t.prisma);
  const user = await createUser(t.prisma);
  const cookie = accessCookie((await login(t.http)).access);
  return { t, api: api(t, cookie), cookie, userId: user.id };
}

/** Business "today" (same rule as the API's Clock). */
export function today(): string {
  return todayInBusinessTz(process.env.BUSINESS_TZ || DEFAULT_BUSINESS_TZ);
}

export function daysFromToday(n: number): string {
  return addDays(today(), n);
}

/** Valid Israeli ID: appends the check digit to 8 digits. */
export function israeliId(first8: string): string {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let n = Number(first8[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return `${first8}${(10 - (sum % 10)) % 10}`;
}

/**
 * Superagent parser that keeps binary bodies as a Buffer: `.buffer(true).parse(binaryParser)`.
 * (Superagent hands the raw Node response stream to custom parsers; its typings do not say so.)
 */
export function binaryParser(
  res: unknown,
  callback: (err: Error | null, body: Buffer) => void,
): void {
  const stream = res as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (err: Error) => callback(err, Buffer.alloc(0)));
}

/** Expects `{ statusCode, message, errors? }` with the given key and (optionally) field errors. */
export function expectError(
  res: Response,
  status: number,
  message: string,
  errors?: { path: string; message: string }[],
): void {
  expect({ status: res.status, body: res.body as unknown }).toEqual({
    status,
    body: errors ? { statusCode: status, message, errors } : { statusCode: status, message },
  });
}
