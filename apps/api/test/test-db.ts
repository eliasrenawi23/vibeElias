/**
 * Guards against running the destructive e2e suite (TRUNCATE) on a non-test database.
 * Returns the test database URL.
 */
export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set (see .env.example). Refusing to run e2e tests.');
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL must point to a test database (got "${dbName}").`);
  }
  const mainUrl = process.env.MAIN_DATABASE_URL;
  if (mainUrl && mainUrl === url) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
  }
  return url;
}
