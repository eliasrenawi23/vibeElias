import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { PrismaClient, Role, User } from '@prisma/client';
import request from 'supertest';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { hashPassword } from '../src/auth/password';
import { PrismaService } from '../src/prisma/prisma.service';

export const XHR = { 'X-Requested-With': 'XMLHttpRequest' } as const;

export const TEST_USER = {
  email: 'owner@renawi.test',
  password: 'Secret123!',
  name: 'אליאס רנאוי',
} as const;

export interface TestApp {
  app: NestExpressApplication;
  prisma: PrismaService;
  http: ReturnType<NestExpressApplication['getHttpServer']>;
}

/** Boots the full AppModule with the same HTTP setup as main.ts (minus Swagger). */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), http: app.getHttpServer() };
}

/** Empties every table of the test database (between suites). */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export async function createUser(
  prisma: PrismaClient,
  overrides: Partial<{ email: string; password: string; name: string; role: Role }> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: overrides.email ?? TEST_USER.email,
      name: overrides.name ?? TEST_USER.name,
      role: overrides.role ?? 'ADMIN',
      passwordHash: await hashPassword(overrides.password ?? TEST_USER.password),
    },
  });
}

export interface ParsedCookie {
  value: string;
  /** Lower-cased attribute names -> values (`httponly` -> ''). */
  attributes: Record<string, string>;
  raw: string;
}

/** `Set-Cookie` headers of a response, keyed by cookie name. */
export function setCookies(res: Response): Record<string, ParsedCookie> {
  const header = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(header) ? (header as string[]) : header ? [String(header)] : [];
  const out: Record<string, ParsedCookie> = {};
  for (const raw of list) {
    const [pair = '', ...attrs] = raw.split(';').map((p) => p.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const attributes: Record<string, string> = {};
    for (const attr of attrs) {
      const i = attr.indexOf('=');
      if (i === -1) attributes[attr.toLowerCase()] = '';
      else attributes[attr.slice(0, i).toLowerCase()] = attr.slice(i + 1);
    }
    out[name] = { value: decodeURIComponent(pair.slice(eq + 1)), attributes, raw };
  }
  return out;
}

export interface LoginResult {
  res: Response;
  access: string;
  refresh: string;
}

export async function login(
  http: TestApp['http'],
  email: string = TEST_USER.email,
  password: string = TEST_USER.password,
): Promise<LoginResult> {
  const res = await request(http)
    .post('/api/auth/login')
    .set(XHR)
    .send({ email, password })
    .expect(200);
  const cookies = setCookies(res);
  const access = cookies.rm_access?.value;
  const refresh = cookies.rm_refresh?.value;
  if (!access || !refresh) throw new Error('login did not set both cookies');
  return { res, access, refresh };
}

export const accessCookie = (token: string) => `rm_access=${token}`;
export const refreshCookie = (token: string) => `rm_refresh=${token}`;
