// The API process runs in UTC (TZ=UTC in .env / the container). Calendar dates are `@db.Date`
// values that travel as YYYY-MM-DD strings; "today" and cron schedules use BUSINESS_TZ
// (Asia/Jerusalem). Must be set before anything creates a Date.
process.env.TZ ??= 'UTC';

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, setupSwagger, SWAGGER_PATH } from './app.setup';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  setupSwagger(app);
  // Graceful shutdown on SIGTERM/SIGINT (closes Prisma via onModuleDestroy).
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/api (TZ=${process.env.TZ})`);
  logger.log(`Swagger UI on http://localhost:${port}/${SWAGGER_PATH}`);
}

void bootstrap();
