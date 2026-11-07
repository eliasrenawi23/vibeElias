# Renawi Motors

**Renawi Motors** (רינאוי מוטורס / ريناوي موتورز) is the management system for a small Israeli
business that trades used cars and leases taxi licences ("green numbers") and taxi cars to
drivers. It is the single place for vehicles and per-car costs, taxi licences, drivers, lease
contracts with prorated monthly rent and deposits, driver ledgers and balances, buy/sell deals
with trade-ins, consignment and VAT on the margin, documents with expiry reminders, contacts and
leads, and reports — in Hebrew, Arabic and English with right-to-left support and light/dark
themes.

## Prerequisites

- Node.js 22 or newer (developed on Node 25) and npm 10+ (npm workspaces; no pnpm/yarn needed)
- Docker with Docker Compose v2 (local PostgreSQL 17)
- Git (the repo enforces LF line endings through `.gitattributes`)

## Quick start

```bash
cp .env.example .env              # defaults work for local development
docker compose up -d postgres     # PostgreSQL 17 on localhost:5432 (databases renawi + renawi_test)
npm install
npm run db:migrate                # apply Prisma migrations
npm run db:seed                   # admin user + demo data
npm run dev                       # shared (watch) + API on :3000 + web on :5173
```

Then open <http://localhost:5173> and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
The API documentation (Swagger) is at <http://localhost:3000/api/docs>.

Optional database UI: `docker compose --profile tools up -d` starts pgAdmin on
<http://localhost:5050> (login `admin@example.com` / `renawi`).

## Common scripts

| Script                              | What it does                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                       | Builds `@renawi/shared`, then runs shared (watch), API and web |
| `npm run build`                     | Builds shared → api → web                                      |
| `npm run lint` / `npm run lint:fix` | ESLint (flat config) over the whole repo                       |
| `npm run format`                    | Prettier                                                       |
| `npm run typecheck`                 | `tsc --noEmit` in every workspace                              |
| `npm test`                          | Unit tests in every workspace                                  |
| `npm run test:e2e`                  | API end-to-end tests against `TEST_DATABASE_URL`               |
| `npm run db:migrate`                | `prisma migrate dev` (create/apply migrations in development)  |
| `npm run db:deploy`                 | `prisma migrate deploy` (apply migrations, production/CI)      |
| `npm run db:seed`                   | Seed admin user, settings and demo data (idempotent)           |
| `npm run db:reset`                  | Drop, re-migrate and re-seed the development database          |
| `npm run db:studio`                 | Prisma Studio                                                  |

Root scripts load `.env` (via `dotenv-cli`) before calling Prisma or starting the apps.

## Workspace layout

| Path              | Contents                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | NestJS 11 + Prisma 6 + PostgreSQL 17 REST API (`/api`, Swagger at `/api/docs`)                                 |
| `apps/web`        | React 19 + Vite + Ant Design v6 web app / PWA (he, ar, en; RTL; light/dark)                                    |
| `packages/shared` | `@renawi/shared`: zod schemas and enums shared by API and web, money/date/bidi/plate helpers, he/ar/en locales |
| `packages/brand`  | `@renawi/brand`: logos, icons, design tokens (CSS + TS), brand preview page                                    |
| `deploy/`         | Database init scripts (production deployment files follow in a later milestone)                                |
| `docs/`           | Research, brand style guide, operations and user guides                                                        |

## Documentation

See [`docs/`](docs/) — Israeli market & regulation research, brand style guide, deployment and
restore procedures, and user guides.
