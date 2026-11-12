# Renawi Motors

**Renawi Motors** (רינאוי מוטורס / ريناوي موتورز) is the management system for a small Israeli
business that trades used cars and leases taxi licences ("green numbers") and taxi cars to
drivers. It is the single place for vehicles and per-car costs, taxi licences, drivers, lease
contracts with prorated monthly rent and deposits, driver ledgers and balances, buy/sell deals
with trade-ins, consignment and VAT on the margin, documents with expiry reminders, contacts and
leads, and reports — in Hebrew, Arabic and English with right-to-left support and light/dark
themes.

## How the project is built

A TypeScript monorepo (npm workspaces) with one backend, one frontend, one database and two shared packages.

| Part              | What it is                                                                                       | Where                          |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| **Backend (BE)**  | REST API in **NestJS 11** on Node.js, TypeScript                                                 | `apps/api`                     |
| **Frontend (FE)** | Single-page web app in **React 19** + **Vite 8** with **Ant Design 6**, installable as a PWA     | `apps/web`                     |
| **Database (DB)** | **PostgreSQL 17** (Docker), accessed through the **Prisma 6** ORM with SQL migrations            | `apps/api/prisma`              |
| **Shared code**   | Validation schemas, enums, money/date/plate helpers and the translations, used by both BE and FE | `packages/shared`              |
| **Brand**         | Logo files, icons, colour and type tokens, style guide                                           | `packages/brand`, `docs/brand` |

### Backend (`apps/api`)

- **Framework**: NestJS 11, one module per business area: auth, users, settings, contacts, vehicles, documents,
  taxi-licenses, drivers, leases, ledger, fines, deals, dashboard, reminders, reports.
- **API style**: REST under `/api`, JSON. Interactive docs (Swagger) at `/api/docs`.
- **Validation**: zod schemas from `packages/shared` (via `nestjs-zod`), so the FE and BE check the same rules.
- **Auth**: email + password hashed with argon2; short-lived JWT access token and rotating refresh token, both in
  httpOnly cookies; role field on users (single admin today).
- **Money**: `Decimal(12,2)` in the database, `decimal.js` for arithmetic, shekels only.
- **Files**: uploads stored on disk under `UPLOAD_DIR`, type checked by file signature, image thumbnails with `sharp`.
- **Scheduled jobs**: nightly rent billing (`@nestjs/schedule`, Asia/Jerusalem time).
- **PDFs**: lease contracts, handover / return reports, deposit and payment confirmations, sale /
  purchase / consignment agreements and the disclosure form in he/ar/en, rendered from Handlebars
  templates by headless Chromium (Playwright) inside the API and stored as documents.
- **Exports**: Excel and CSV reports with `exceljs`.
- **Audit log**: every create, update and delete on core records is recorded.
- **Tests**: Jest unit tests and Jest + supertest end-to-end tests against a separate test database.

### Frontend (`apps/web`)

- **Framework**: React 19 with React Router 7, built and served by Vite 8.
- **UI library**: Ant Design 6, themed from the brand tokens; light and dark mode.
- **Languages**: Hebrew (default), Arabic and English with `react-i18next`; the layout flips between right-to-left
  and left-to-right at runtime.
- **Data**: TanStack Query for server data; the app talks to the API through `/api` with cookies.
- **Forms**: `react-hook-form` with the shared zod schemas.
- **Charts**: Recharts. **Dates**: dayjs.
- **PWA**: `vite-plugin-pwa`, so it can be installed on a phone home screen.
- **Tests**: Vitest + Testing Library for components, Playwright for browser flows.

### Database

- PostgreSQL 17 running in Docker (`docker-compose.yml`), data kept in a Docker volume.
- Schema and migrations in `apps/api/prisma` (Prisma 6). Two SQL views give driver balances and overdue ageing.
- Demo data comes from `npm run db:seed` (`SEED_DEMO=false`: only the admin user and empty business
  settings).
- Main tables: users, contacts, drivers, vehicles, inventory cycles, vehicle expenses, insurance policies,
  odometer logs, taxi licences, lease contracts and segments, ledger entries and payment allocations, traffic
  fines, deals and deal payments, documents, reminders, settings, audit log.

### Shared packages

- `packages/shared`: zod schemas and enums that mirror the database, helpers (`formatMoney`, VAT on margin, rent
  proration, working days, plate formatting, right-to-left text isolation) and the three translation files in
  `src/locales/{he,ar,en}`.
- `packages/brand`: logo (taxi roof-sign mark) in Hebrew, Arabic and English lockups, app icons, `tokens.css` /
  `tokens.ts` generated from one source.

### Tooling and hosting

- **Language**: TypeScript everywhere; ESLint + Prettier.
- **Local development**: Docker for PostgreSQL, `npm run dev` starts API (port 3000) and web (port 5173); the web
  dev server proxies `/api` to the API.
- **Production setup**: one small Linux server running Docker Compose (`docker-compose.prod.yml`:
  PostgreSQL, the API image with Chromium, nginx serving the built web app, Caddy for HTTPS) with a
  backup container for nightly database and file backups to an S3 bucket. The images, compose
  files, Caddy / nginx configuration, backup and restore scripts and GitHub Actions workflows are
  built and were tested end to end on a local copy of the stack
  (`deploy/docker-compose.local-test.yml`); deploying to a real server waits for the owner's
  domain and server (step by step: [docs/ops/deploy.md](docs/ops/deploy.md)).
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, the API
  end-to-end tests on PostgreSQL 17, the Playwright UI tests and a check of the deployment files.

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

## Production

One small Linux server (Hetzner, Ubuntu 24.04) runs the stack with Docker Compose
(`docker-compose.prod.yml`): Caddy (automatic HTTPS) → nginx (the built web app, `/api/` proxied)
→ API (with Chromium for PDFs) → PostgreSQL 17, plus a backup container that sends a nightly
database dump and the uploaded documents to a Backblaze B2 bucket. Every push to `main` runs **CI**
(`.github/workflows/ci.yml`); **Deploy** (`.github/workflows/deploy.yml`) is started by hand in
GitHub Actions: it builds and pushes the images to GHCR and runs `deploy/deploy.sh` on the server
over SSH (automatic deploys after a green CI run can be switched on later, see the deploy guide).
Runtime secrets live only in the server's `.env` (template: `.env.production.example`).

- [Deploy guide](docs/ops/deploy.md): server, domain, HTTPS, first admin, backups, GitHub secrets,
  updates, rollback, logs, common problems
- [Restore guide](docs/ops/restore.md): restoring backups and the quarterly rehearsal
- [Security](docs/ops/security.md): what is hardened, owner checklist, rotating secrets, personal data
- User guides: [English](docs/user-guide.en.md) · [עברית](docs/user-guide.he.md)
- Local rehearsal of the production stack over HTTP: `deploy/docker-compose.local-test.yml`

## Workspace layout

| Path              | Contents                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`        | NestJS 11 + Prisma 6 + PostgreSQL 17 REST API (`/api`, Swagger at `/api/docs`)                                                             |
| `apps/web`        | React 19 + Vite + Ant Design v6 web app / PWA (he, ar, en; RTL; light/dark)                                                                |
| `packages/shared` | `@renawi/shared`: zod schemas and enums shared by API and web, money/date/bidi/plate helpers, he/ar/en locales                             |
| `packages/brand`  | `@renawi/brand`: logos, icons, design tokens (CSS + TS), brand preview page                                                                |
| `deploy/`         | Production stack: Caddy and nginx config, backup / restore image, deploy and provision scripts, first-admin tool, local rehearsal, DB init |
| `.github/`        | GitHub Actions: CI (lint, types, unit, API e2e, Playwright, deployment files) and the manual Deploy                                        |
| `docs/ops`        | Operations: deploy, restore, security                                                                                                      |
| `docs/`           | User guides (`user-guide.en.md`, `user-guide.he.md`), research, brand style guide, plans                                                   |

## Documentation

See [`docs/`](docs/) — Israeli market & regulation research, brand style guide, deployment and
restore procedures, and user guides.

- [`docs/plans/`](docs/plans/) — design and implementation plans
