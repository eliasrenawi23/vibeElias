import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../errors/app-exception';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Header every mutating request must carry (sent by the web `http.ts` client). */
export const REQUESTED_WITH_HEADER = 'X-Requested-With';
export const REQUESTED_WITH_VALUE = 'XMLHttpRequest';

/**
 * CSRF defence for cookie auth: mutating requests must carry `X-Requested-With: XMLHttpRequest`.
 * Browsers cannot add custom headers to cross-site form posts, and CORS only allows the header
 * from the configured origin. Missing header -> 403 `errors.forbidden`.
 */
@Injectable()
export class RequestedWithGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATING_METHODS.has(req.method.toUpperCase())) return true;
    if (req.get(REQUESTED_WITH_HEADER) === REQUESTED_WITH_VALUE) return true;
    throw AppException.forbidden();
  }
}
