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
    });
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
    });
  });
});
