import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { Readable } from 'node:stream';
import { contentDisposition } from './documents.controller';
import { sanitizeFileName } from './documents.service';
import { sniffFileType } from './file-type';
import { LocalDiskStorage } from './storage/local-disk.storage';
import {
  isValidStorageKey,
  newStorageKey,
  StorageNotFoundError,
  thumbKeyOf,
} from './storage/storage.service';

describe('sniffFileType', () => {
  it('detects the allowed types from magic bytes only', () => {
    expect(sniffFileType(Buffer.from('%PDF-1.7\n...'))).toEqual({
      mime: 'application/pdf',
      ext: 'pdf',
      isImage: false,
    });
    expect(sniffFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))).toMatchObject({
      mime: 'image/jpeg',
      ext: 'jpg',
    });
    expect(
      sniffFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toMatchObject({ mime: 'image/png', ext: 'png', isImage: true });
    expect(sniffFileType(Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 ', 'latin1'))).toMatchObject({
      mime: 'image/webp',
      ext: 'webp',
    });
  });

  it('rejects everything else (text, gif, RIFF/WAVE, truncated signatures)', () => {
    expect(sniffFileType(Buffer.from('hello, this is text'))).toBeNull();
    expect(sniffFileType(Buffer.from('GIF89a', 'latin1'))).toBeNull();
    expect(sniffFileType(Buffer.from('RIFF\x10\x00\x00\x00WAVEfmt ', 'latin1'))).toBeNull();
    expect(sniffFileType(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
    expect(sniffFileType(Buffer.from('%PD'))).toBeNull();
    expect(sniffFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe('contentDisposition', () => {
  it('sends an ASCII fallback and the RFC 5987 UTF-8 name', () => {
    expect(contentDisposition('inline', 'license.pdf')).toBe(
      `inline; filename="license.pdf"; filename*=UTF-8''license.pdf`,
    );
    expect(contentDisposition('attachment', 'רישיון (1).pdf')).toBe(
      `attachment; filename="______ (1).pdf"; filename*=UTF-8''` +
        '%D7%A8%D7%99%D7%A9%D7%99%D7%95%D7%9F%20%281%29.pdf',
    );
    expect(contentDisposition('inline', `a"b\\c'd*.png`)).toBe(
      `inline; filename="a_b_c'd*.png"; filename*=UTF-8''a%22b%5Cc%27d%2A.png`,
    );
  });
});

describe('sanitizeFileName', () => {
  it('keeps the base name without paths, control, bidi or reserved characters', () => {
    expect(sanitizeFileName('C:\\scans\\פוליסה.pdf', 'insurance', 'pdf')).toBe('פוליסה.pdf');
    expect(sanitizeFileName('../../etc/passwd', 'other', 'pdf')).toBe('passwd.pdf');
    expect(sanitizeFileName('\u202Egnp.exe', 'photo', 'png')).toBe('gnp.exe');
    expect(sanitizeFileName('a<b>:c?.jpg', 'photo', 'jpg')).toBe('abc.jpg');
  });

  it('falls back to <kind>.<ext> and appends the sniffed extension when missing', () => {
    expect(sanitizeFileName('', 'car_license', 'pdf')).toBe('car_license.pdf');
    expect(sanitizeFileName('..', 'photo', 'png')).toBe('photo.png');
    expect(sanitizeFileName('scan', 'photo', 'jpg')).toBe('scan.jpg');
    expect(sanitizeFileName('x'.repeat(300), 'photo', 'jpg')).toHaveLength(204);
  });
});

describe('storage keys', () => {
  it('builds yyyy/mm/<uuid>.<ext> keys and thumbnail keys next to them', () => {
    const key = newStorageKey('pdf', new Date('2026-03-09T23:30:00.000Z'));
    expect(key).toMatch(/^2026\/03\/[0-9a-f-]{36}\.pdf$/);
    expect(isValidStorageKey(key)).toBe(true);
    expect(thumbKeyOf(key)).toBe(`${key}.thumb.webp`);
    expect(isValidStorageKey(thumbKeyOf(key))).toBe(true);
  });

  it('rejects keys that could escape the root', () => {
    for (const bad of [
      '../x.pdf',
      '/abs.pdf',
      'a/../../b.pdf',
      'a\\b.pdf',
      '',
      'a//b.pdf',
      '.hidden',
    ]) {
      expect(isValidStorageKey(bad)).toBe(false);
    }
  });
});

describe('LocalDiskStorage', () => {
  let root: string;
  let storage: LocalDiskStorage;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'renawi-storage-unit-'));
    storage = new LocalDiskStorage(join(root, 'uploads')).ensureRoot();
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  async function read(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  }

  it('puts, stats, streams and deletes buffers and streams', async () => {
    await storage.put(Buffer.from('hello'), '2026/11/a.pdf', 'application/pdf');
    expect(await storage.stat('2026/11/a.pdf')).toEqual({ size: 5 });
    expect(await read(await storage.getStream('2026/11/a.pdf'))).toBe('hello');

    await storage.put(
      Readable.from([Buffer.from('str'), Buffer.from('eam')]),
      '2026/11/b.png',
      'image/png',
    );
    expect(await storage.exists('2026/11/b.png')).toBe(true);
    expect(await read(await storage.getStream('2026/11/b.png'))).toBe('stream');

    await storage.delete('2026/11/a.pdf');
    await storage.delete('2026/11/a.pdf'); // missing is not an error
    expect(await storage.stat('2026/11/a.pdf')).toBeNull();
    await expect(storage.getStream('2026/11/a.pdf')).rejects.toBeInstanceOf(StorageNotFoundError);
  });

  it('maps keys inside the root only', () => {
    expect(storage.pathOf('2026/11/a.pdf')).toBe(join(root, 'uploads', '2026', '11', 'a.pdf'));
    expect(storage.pathOf('2026/11/a.pdf').startsWith(storage.root + sep)).toBe(true);
    expect(() => storage.pathOf('../outside.pdf')).toThrow();
  });
});
