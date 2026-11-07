import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { Clock } from './clock';

/**
 * Cross-cutting building blocks. The global pipe, exception filter, guards and interceptors from
 * this folder are registered as `APP_*` providers in `AppModule` (so they also apply in e2e
 * tests, which do not run `main.ts`); `AuditService` is exported for explicit audit writes and
 * `Clock` for the business-time-zone "today".
 */
@Global()
@Module({
  providers: [AuditService, Clock],
  exports: [AuditService, Clock],
})
export class CommonModule {}
