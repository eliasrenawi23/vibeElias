import { BACKUP_MAX_AGE_HOURS, type BackupStatus } from '@renawi/shared';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Reported when the status file is missing, unreadable or malformed. */
export const NO_BACKUP: Readonly<BackupStatus> = Object.freeze({
  lastSuccessAt: null,
  lastFile: null,
  ok: false,
  offsite: null,
  remote: null,
});

/**
 * Parses the status file the backup sidecar writes after every successful run
 * (`{"lastSuccessAt": "<ISO instant>", "lastFile": "<name>", "offsite": true|false,
 * "remote": "s3:<bucket>/<prefix>"}`). `ok` = the last success is at most `maxAgeHours` old (and
 * not in the future by more than a few minutes of clock skew). `offsite` is passed through
 * (`null` when the file predates the field or holds something else); `remote` only when
 * `offsite` is true. Anything unusable (no file, bad JSON, no valid instant) reports `NO_BACKUP`.
 */
export function parseBackupStatus(
  raw: string | null,
  now: Date,
  maxAgeHours: number = BACKUP_MAX_AGE_HOURS,
): BackupStatus {
  if (raw === null || !raw.trim()) return { ...NO_BACKUP };
  let data: unknown;
  try {
    data = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch {
    return { ...NO_BACKUP };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...NO_BACKUP };
  const record = data as Record<string, unknown>;
  const at = typeof record.lastSuccessAt === 'string' ? new Date(record.lastSuccessAt) : null;
  if (!at || Number.isNaN(at.getTime())) return { ...NO_BACKUP };
  const lastFile =
    typeof record.lastFile === 'string' && record.lastFile.trim() ? record.lastFile.trim() : null;
  const offsite = typeof record.offsite === 'boolean' ? record.offsite : null;
  const remote =
    offsite === true && typeof record.remote === 'string' && record.remote.trim()
      ? record.remote.trim()
      : null;
  const ageMs = now.getTime() - at.getTime();
  const skewMs = 5 * 60_000;
  return {
    lastSuccessAt: at.toISOString(),
    lastFile,
    ok: ageMs >= -skewMs && ageMs <= maxAgeHours * 3_600_000,
    offsite,
    remote,
  };
}

/** Reads and parses the status file (relative paths resolve against the working directory). */
export async function readBackupStatus(
  file: string,
  now: Date = new Date(),
): Promise<BackupStatus> {
  let raw: string | null = null;
  try {
    raw = await readFile(resolve(file), 'utf8');
  } catch {
    raw = null;
  }
  return parseBackupStatus(raw, now);
}
