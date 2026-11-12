import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NO_BACKUP, parseBackupStatus, readBackupStatus } from './backup-status';

const NOW = new Date('2026-11-12T10:00:00.000Z');

describe('parseBackupStatus', () => {
  it('missing, empty or malformed content -> ok false with nulls', () => {
    expect(parseBackupStatus(null, NOW)).toEqual(NO_BACKUP);
    expect(parseBackupStatus('  ', NOW)).toEqual(NO_BACKUP);
    expect(parseBackupStatus('{not json', NOW)).toEqual(NO_BACKUP);
    expect(parseBackupStatus('[]', NOW)).toEqual(NO_BACKUP);
    expect(parseBackupStatus('{"lastFile":"x.dump"}', NOW)).toEqual(NO_BACKUP);
    expect(parseBackupStatus('{"lastSuccessAt":"yesterday"}', NOW)).toEqual(NO_BACKUP);
  });

  it('a recent success is ok (BOM tolerated, file name trimmed)', () => {
    const raw = '﻿{"lastSuccessAt":"2026-11-12T00:30:00Z","lastFile":" renawi-2026-11-12.dump "}';
    expect(parseBackupStatus(raw, NOW)).toEqual({
      lastSuccessAt: '2026-11-12T00:30:00.000Z',
      lastFile: 'renawi-2026-11-12.dump',
      ok: true,
      // A status file of an older sidecar has no off-site field: unknown.
      offsite: null,
      remote: null,
    });
  });

  it('passes the off-site flag and the bucket through (remote only when copied)', () => {
    const at = '2026-11-12T00:30:00Z';
    const parse = (extra: Record<string, unknown>) =>
      parseBackupStatus(JSON.stringify({ lastSuccessAt: at, lastFile: 'db.dump', ...extra }), NOW);
    expect(parse({ offsite: true, remote: ' s3:renawi-backups/renawi/ ' })).toMatchObject({
      ok: true,
      offsite: true,
      remote: 's3:renawi-backups/renawi/',
    });
    expect(parse({ offsite: false })).toMatchObject({ ok: true, offsite: false, remote: null });
    expect(parse({ offsite: false, remote: 's3:x/' })).toMatchObject({ offsite: false, remote: null });
    expect(parse({ offsite: true })).toMatchObject({ offsite: true, remote: null });
    expect(parse({ offsite: 'yes', remote: 's3:x/' })).toMatchObject({ offsite: null, remote: null });
  });

  it('older than the maximum age (36 h) or far in the future -> not ok', () => {
    const at = (iso: string) => JSON.stringify({ lastSuccessAt: iso, lastFile: null });
    expect(parseBackupStatus(at('2026-11-10T22:00:00.000Z'), NOW).ok).toBe(true); // exactly 36 h
    expect(parseBackupStatus(at('2026-11-10T21:59:00.000Z'), NOW).ok).toBe(false);
    expect(parseBackupStatus(at('2026-11-12T10:04:00.000Z'), NOW).ok).toBe(true); // small skew
    expect(parseBackupStatus(at('2026-11-13T10:00:00.000Z'), NOW).ok).toBe(false);
    expect(parseBackupStatus(at('2026-11-12T09:00:00.000Z'), NOW, 0.5).ok).toBe(false);
  });
});

describe('readBackupStatus', () => {
  const dir = mkdtempSync(join(tmpdir(), 'renawi-backup-status-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads the file; a missing file is NO_BACKUP', async () => {
    const file = join(dir, 'last-success.json');
    expect(await readBackupStatus(file, NOW)).toEqual(NO_BACKUP);
    writeFileSync(
      file,
      JSON.stringify({ lastSuccessAt: '2026-11-12T01:00:00.000Z', lastFile: 'a.dump' }),
    );
    expect(await readBackupStatus(file, NOW)).toEqual({
      lastSuccessAt: '2026-11-12T01:00:00.000Z',
      lastFile: 'a.dump',
      ok: true,
      offsite: null,
      remote: null,
    });
  });
});
