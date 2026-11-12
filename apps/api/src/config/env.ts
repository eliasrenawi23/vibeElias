import { z } from 'zod';
import { parseDurationMs } from './duration';

const bool = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const duration = z.string().refine(
  (v) => {
    try {
      parseDurationMs(v);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid duration (use e.g. 15m, 12h, 30d)' },
);

/** Environment variables read by the API (see the repo-root `.env.example`). */
export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TTL: duration.default('15m'),
  REFRESH_TTL: duration.default('30d'),
  COOKIE_SECURE: bool.default('false'),
  /** Comma-separated list of allowed browser origins. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** Express `trust proxy` setting when running behind a reverse proxy (e.g. `1`, `loopback`). */
  TRUST_PROXY: z.string().optional(),
  BUSINESS_TZ: z.string().default('Asia/Jerusalem'),
  /** Login attempts allowed per IP per minute. */
  LOGIN_THROTTLE_LIMIT: z.coerce.number().int().min(1).default(10),
  /** Set to false to disable the scheduled jobs (tests, one-off scripts). */
  CRON_ENABLED: bool.default('true'),
  /** Root folder of uploaded documents (relative to the API working directory). */
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),
  /** Maximum upload size in megabytes (decimals allowed). */
  MAX_UPLOAD_MB: z.coerce.number().positive().max(200).default(20),
  /** JSON status file written by the backup sidecar after each successful run. */
  BACKUP_STATUS_FILE: z.string().min(1).default('./data/backup/last-success.json'),
  /** PDF renders running at the same time in the shared Chromium (others wait in a queue). */
  PDF_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  /** Upper limit of one PDF render (page load + print), in milliseconds. */
  PDF_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
});
export type Env = z.infer<typeof EnvSchema>;

/** `ConfigModule.forRoot({ validate })` hook: fails fast with a readable list of problems. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
