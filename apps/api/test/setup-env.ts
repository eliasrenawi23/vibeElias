import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireTestDatabaseUrl } from './test-db';

// Runs in every e2e test file before the app modules are imported.
process.env.MAIN_DATABASE_URL = process.env.DATABASE_URL;
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.TZ = 'UTC';
process.env.COOKIE_SECURE = 'false';
process.env.CRON_ENABLED = 'false';
// The suites log in many times; the 10/min production limit is not what is under test here.
process.env.LOGIN_THROTTLE_LIMIT = '1000';
// Uploads go to a fresh temporary folder per test file (removed by the suites that write files).
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'renawi-e2e-uploads-'));
// Backup status file inside the same temporary folder (the backup-status tests write it).
process.env.BACKUP_STATUS_FILE = join(process.env.UPLOAD_DIR, 'backup', 'last-success.json');
// Small limit so the 413 test does not need a 20 MB body.
process.env.MAX_UPLOAD_MB = '1';
