import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { LOGIN_THROTTLER } from './auth/auth.constants';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { CommonModule } from './common/common.module';
import { ContactsModule } from './contacts/contacts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DealsModule } from './deals/deals.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestedWithGuard } from './common/guards/requested-with.guard';
import { DecimalToNumberInterceptor } from './common/interceptors/decimal-to-number.interceptor';
import { Env, validateEnv } from './config/env';
import { DocumentsModule } from './documents/documents.module';
import { DriversModule } from './drivers/drivers.module';
import { FinesModule } from './fines/fines.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { LeasesModule } from './leases/leases.module';
import { LedgerModule } from './ledger/ledger.module';
import { PrismaModule } from './prisma/prisma.module';
import { SettingsModule } from './settings/settings.module';
import { TaxiLicensesModule } from './taxi-licenses/taxi-licenses.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Workspace scripts run in apps/api; the shared .env lives at the repo root.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [
          {
            name: LOGIN_THROTTLER,
            ttl: 60_000,
            limit: config.get('LOGIN_THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
    PrismaModule,
    CommonModule,
    UsersModule,
    AuthModule,
    SettingsModule,
    ContactsModule,
    VehiclesModule,
    TaxiLicensesModule,
    DriversModule,
    LedgerModule,
    LeasesModule,
    FinesModule,
    DealsModule,
    DashboardModule,
    DocumentsModule,
    HealthModule,
    JobsModule,
  ],
  providers: [
    // Validates every @Body/@Query/@Param typed with a createZodDto() class.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Guard order matters: CSRF header check, then authentication, then roles.
    { provide: APP_GUARD, useClass: RequestedWithGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Interceptor order: the first one wraps the others, so serialisation runs last.
    { provide: APP_INTERCEPTOR, useClass: DecimalToNumberInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
