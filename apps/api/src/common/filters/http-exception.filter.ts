import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { AppException, ErrorBody, ErrorKey, FieldError } from '../errors/app-exception';

/** Looks like an i18n key (`auth.invalidCredentials`, `validation.maxLength::{"max":5}`). */
const I18N_KEY_RE = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+(::.*)?$/s;

const DEFAULT_KEYS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorKey.validation,
  [HttpStatus.UNAUTHORIZED]: ErrorKey.unauthorized,
  [HttpStatus.FORBIDDEN]: ErrorKey.forbidden,
  [HttpStatus.NOT_FOUND]: ErrorKey.notFound,
  [HttpStatus.CONFLICT]: ErrorKey.conflict,
  // Multer's LIMIT_FILE_SIZE (and over-sized bodies) arrive as PayloadTooLargeException.
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorKey.fileTooLarge,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorKey.unsupportedFileType,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorKey.tooManyAttempts,
};

function defaultKey(status: number): string {
  return DEFAULT_KEYS[status] ?? (status >= 500 ? ErrorKey.server : ErrorKey.generic);
}

interface IssueLike {
  path?: (string | number)[];
  message?: string;
}

/** zod issues -> `[{ path: 'a.b.0', message: '<i18n key>' }]`. */
export function zodIssuesToFieldErrors(issues: IssueLike[] | undefined): FieldError[] {
  return (issues ?? []).map((i) => ({
    path: (i.path ?? []).join('.'),
    message: i.message ?? ErrorKey.validation,
  }));
}

/**
 * Global exception filter: every error leaves the API as
 * `{ statusCode, message: '<i18n key>', errors?: [{ path, message }] }`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }
    if (res.headersSent) return;
    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown): ErrorBody {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as { issues?: IssueLike[] } | undefined;
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: ErrorKey.validation,
        errors: zodIssuesToFieldErrors(zodError?.issues),
      };
    }

    if (exception instanceof AppException) {
      return exception.getResponse() as ErrorBody;
    }

    if (exception instanceof ThrottlerException) {
      return { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: ErrorKey.tooManyAttempts };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const raw =
        typeof response === 'string'
          ? response
          : (response as { message?: unknown } | undefined)?.message;
      const message =
        typeof raw === 'string' && I18N_KEY_RE.test(raw) ? raw : defaultKey(statusCode);
      return { statusCode, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    // Errors thrown by Express middleware (e.g. malformed JSON from body-parser) carry a status.
    const status = (exception as { status?: unknown } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return { statusCode: status, message: defaultKey(status) };
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: ErrorKey.server };
  }

  private fromPrisma(e: Prisma.PrismaClientKnownRequestError): ErrorBody {
    switch (e.code) {
      case 'P2002': {
        // Unique constraint: report the offending field(s).
        const target = e.meta?.target;
        const fields = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
        return {
          statusCode: HttpStatus.CONFLICT,
          message: ErrorKey.conflict,
          errors: fields.map((path) => ({ path, message: ErrorKey.conflict })),
        };
      }
      case 'P2003': // foreign key violation
      case 'P2014': // required relation violation
        return { statusCode: HttpStatus.CONFLICT, message: ErrorKey.conflict };
      case 'P2001':
      case 'P2015':
      case 'P2025': // record to update / delete not found
        return { statusCode: HttpStatus.NOT_FOUND, message: ErrorKey.notFound };
      default:
        this.logger.error(`Prisma error ${e.code}: ${e.message}`);
        return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: ErrorKey.server };
    }
  }
}
