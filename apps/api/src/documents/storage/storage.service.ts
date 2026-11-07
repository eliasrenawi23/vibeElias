import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

/** Size of a stored object. */
export interface StoredObjectInfo {
  size: number;
}

/**
 * Binary object storage for uploaded documents. Keys look like `yyyy/mm/<uuid>.<ext>`; the
 * thumbnail of an image lives next to it at `<key>.thumb.webp`. The local-disk implementation
 * (`LocalDiskStorage`) is used today; an S3-compatible adapter can implement the same contract.
 */
export abstract class StorageService {
  /** Stores `body` under `key` (overwrites). `mime` is metadata for object stores. */
  abstract put(body: Buffer | Readable, key: string, mime: string): Promise<void>;
  /** Readable stream of the object; rejects with `StorageNotFoundError` when it does not exist. */
  abstract getStream(key: string): Promise<Readable>;
  /** Size of the object, or null when it does not exist. */
  abstract stat(key: string): Promise<StoredObjectInfo | null>;
  /** Removes the object; a missing object is not an error. */
  abstract delete(key: string): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
}

export class StorageNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`Stored object not found: ${key}`);
    this.name = 'StorageNotFoundError';
  }
}

/** New object key `yyyy/mm/<uuid>.<ext>` (UTC year / month of `now`). */
export function newStorageKey(ext: string, now: Date = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/** Key of the webp thumbnail stored next to an image. */
export function thumbKeyOf(key: string): string {
  return `${key}.thumb.webp`;
}

/** Keys are relative, forward-slash paths of safe characters without `.`/`..` segments. */
const KEY_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

export function isValidStorageKey(key: string): boolean {
  return key.length <= 255 && KEY_RE.test(key) && !key.split('/').some((s) => s === '..');
}
