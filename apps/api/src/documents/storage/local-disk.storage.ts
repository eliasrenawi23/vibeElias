import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  isValidStorageKey,
  StorageNotFoundError,
  StorageService,
  StoredObjectInfo,
} from './storage.service';

function isNotFound(e: unknown): boolean {
  return (e as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}

/**
 * `StorageService` on the local file system, rooted at `UPLOAD_DIR` (a Docker volume in
 * production). Writes go to a temporary file first and are renamed into place, so readers never
 * see a half-written object.
 */
export class LocalDiskStorage extends StorageService {
  readonly root: string;

  constructor(root: string) {
    super();
    this.root = resolve(root);
  }

  /** Creates the root folder (called on boot). */
  ensureRoot(): this {
    mkdirSync(this.root, { recursive: true });
    return this;
  }

  /** Absolute path of a key; rejects keys that could escape the root. */
  pathOf(key: string): string {
    if (!isValidStorageKey(key)) throw new Error(`Invalid storage key: ${key}`);
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new Error(`Storage key escapes root: ${key}`);
    return full;
  }

  async put(body: Buffer | Readable, key: string, _mime: string): Promise<void> {
    const target = this.pathOf(key);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    try {
      if (Buffer.isBuffer(body)) await writeFile(tmp, body);
      else await pipeline(body, createWriteStream(tmp));
      await rename(tmp, target);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const path = this.pathOf(key);
    if (!(await this.exists(key))) throw new StorageNotFoundError(key);
    return createReadStream(path);
  }

  async stat(key: string): Promise<StoredObjectInfo | null> {
    try {
      const s = await stat(this.pathOf(key));
      return s.isFile() ? { size: s.size } : null;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.stat(key)) !== null;
  }
}
