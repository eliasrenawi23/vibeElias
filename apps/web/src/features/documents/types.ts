import type { DocKind, DocumentOwnerKey, Locale } from '@renawi/shared';

/** A stored document as returned by `GET /api/documents?<owner>Id=` and `POST /api/documents`. */
export interface DocumentItem {
  id: string;
  kind: DocKind;
  fileName: string;
  mime: string;
  size: number;
  hasThumb: boolean;
  title: string | null;
  lang: Locale | null;
  expiresAt: string | null;
  createdAt: string;
  /** `/api/documents/:id/file` (same origin; the session cookie authenticates it). */
  url: string;
  /** `/api/documents/:id/thumb` when a thumbnail exists. */
  thumbUrl?: string | null;
}

/** The record a document hangs on: exactly one of the owner keys. */
export type DocumentOwner = Partial<Record<DocumentOwnerKey, string>>;
