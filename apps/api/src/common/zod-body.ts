import type { ZodType, ZodTypeDef } from 'zod';
import { AppException } from './errors/app-exception';
import { zodIssuesToFieldErrors } from './filters/http-exception.filter';

/**
 * Parses an OPTIONAL request body (`POST` actions that may be sent without one; Express 5 leaves
 * `req.body` undefined then). Failures become the standard 400 `errors.validation` response.
 */
export function parseOptionalBody<T>(schema: ZodType<T, ZodTypeDef, unknown>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw AppException.badRequest(undefined, zodIssuesToFieldErrors(parsed.error.issues));
  }
  return parsed.data;
}

/**
 * Parses a REQUIRED request body against a schema the global pipe cannot use (e.g. a
 * discriminated union, which cannot back a DTO class). Failures become 400 `errors.validation`.
 */
export function parseBody<T>(schema: ZodType<T, ZodTypeDef, unknown>, body: unknown): T {
  return parseOptionalBody(schema, body);
}
