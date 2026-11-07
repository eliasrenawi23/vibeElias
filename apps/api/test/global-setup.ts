import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { requireTestDatabaseUrl } from './test-db';

/** Runs once before all e2e suites: applies the Prisma migrations to the test database. */
export default function globalSetup(): void {
  const url = requireTestDatabaseUrl();
  if (process.env.DATABASE_URL === url) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
  }
  const prismaCli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
