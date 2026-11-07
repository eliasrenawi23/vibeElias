import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { toWire } from '../serialization/wire';

/**
 * Global response interceptor: Prisma `Decimal` -> number (2 dp), date-only `Date` fields ->
 * `YYYY-MM-DD`, other `Date`s -> ISO instants. Services can return Prisma rows unchanged.
 */
@Injectable()
export class DecimalToNumberInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => toWire(data)));
  }
}
