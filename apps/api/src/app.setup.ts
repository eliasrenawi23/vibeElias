import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { installValidationErrorMap } from '@renawi/shared';
import cookieParser from 'cookie-parser';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { ACCESS_COOKIE } from './auth/auth.constants';
import type { Env } from './config/env';

export const GLOBAL_PREFIX = 'api';
export const SWAGGER_PATH = 'api/docs';

/** Swagger tags in display order (each controller uses one of these in `@ApiTags`). */
export const SWAGGER_TAGS: readonly { name: string; description: string }[] = [
  { name: 'auth', description: 'Login / refresh / logout (httpOnly cookies) and the current user' },
  { name: 'users', description: 'User accounts (ADMIN)' },
  {
    name: 'settings',
    description: 'Business settings singleton (names, VAT, reminder lead days) and backup status',
  },
  {
    name: 'contacts',
    description: 'Contacts and leads: search, tags, follow-up dates, archive / unarchive',
  },
  {
    name: 'vehicles',
    description: 'Vehicles: list with computed alerts, vehicle file, manual status changes',
  },
  {
    name: 'expenses',
    description: 'Per-vehicle expenses (auto-linked to the open inventory cycle)',
  },
  { name: 'insurance', description: 'Vehicle policies and business-level TRADE / LOT policies' },
  { name: 'odometer', description: 'Odometer readings (the latest by date sets currentKm)' },
  {
    name: 'cycles',
    description: 'Inventory cycles: list, consignment intake, return to the consignor',
  },
  {
    name: 'taxi-licenses',
    description: 'Taxi licences: registered car (12-year rule), open segment, history, alerts',
  },
  {
    name: 'drivers',
    description: 'Drivers: contact, documents expiry alerts, contracts, balance, ageing, statement',
  },
  {
    name: 'leases',
    description:
      'Lease contracts: draft (locks licence / car), activate, segments (swap / rent change), ' +
      'end, renew, deposits, checklists, monthly rent billing (preview / run, nightly job)',
  },
  {
    name: 'ledger',
    description:
      'Driver ledger: charges, payments, credits, void; FIFO allocation; balances and ageing views',
  },
  {
    name: 'fines',
    description: 'Traffic fines: auto-matched driver, reassignment deadline, rebill to the driver',
  },
  {
    name: 'deals',
    description:
      'Deals: purchase (vehicle upsert, buy-back), sale with trade-in, consignment sale ' +
      '(commission / payout); VAT on the margin; payments; disclosure gate; completion / ' +
      'cancellation; ownership-transfer checklist and 6-working-day deadline',
  },
  {
    name: 'documents',
    description:
      'Uploads (pdf / jpeg / png / webp, sniffed), thumbnails and authenticated file streaming',
  },
  {
    name: 'pdf',
    description:
      'Printable PDFs in he / ar / en (lease contract, handover / return, deposit receipt, ' +
      'payment confirmation, sale / purchase / consignment agreements, disclosure form): ' +
      'render + store as a Document, or preview the HTML',
  },
  {
    name: 'reminders',
    description:
      'Reminders feed (expiries, deadlines, follow-ups with lead days) and manual reminders',
  },
  {
    name: 'reports',
    description:
      'Reports (profit, inventory ageing, receivables, expenses, lease income, trade book, ' +
      'fines) as JSON, CSV or XLSX',
  },
  {
    name: 'dashboard',
    description: 'Dashboard KPIs, recent activity and charts',
  },
  { name: 'health', description: 'Liveness / readiness' },
];

/**
 * HTTP-level setup shared by `main.ts` and the e2e tests: `/api` prefix, cookies, CORS with
 * credentials, proxy trust, and zod messages as i18n keys.
 */
export function configureApp(app: NestExpressApplication): void {
  // Generic zod messages become translatable keys (validation.required, ...).
  installValidationErrorMap();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.use(cookieParser());
  app.disable('x-powered-by');

  // Already parsed by the env schema (`parseTrustProxy`): false, a hop count or an address list.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy !== false && trustProxy !== undefined) app.set('trust proxy', trustProxy);

  const origins = config
    .get('CORS_ORIGIN', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Accept-Language', 'X-Requested-With'],
    maxAge: 600,
  });
}

/** The OpenAPI document of the app (tags from `SWAGGER_TAGS`, zod DTOs cleaned up). */
export function buildOpenApiDocument(app: NestExpressApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Renawi Motors API')
    .setDescription(
      'Dealership + taxi-licence leasing API. Log in with POST /api/auth/login (sets httpOnly ' +
        'cookies); every mutating request needs the header X-Requested-With: XMLHttpRequest ' +
        '(added automatically by this page). Errors: { statusCode, message: <i18n key>, errors? }.',
    )
    .setVersion('0.1.0')
    .addCookieAuth(ACCESS_COOKIE);
  for (const tag of SWAGGER_TAGS) builder.addTag(tag.name, tag.description);
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, builder.build()));
}

/** Swagger UI at `/api/docs` (JSON at `/api/docs-json`), authenticated by the access cookie. */
export function setupSwagger(app: NestExpressApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app), {
    customSiteTitle: 'Renawi Motors API',
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      // Serialised into the page with Function#toString, so it must stay self-contained.
      requestInterceptor: function (req: { headers: Record<string, string> }) {
        req.headers['X-Requested-With'] = 'XMLHttpRequest';
        return req;
      },
    },
  });
}
