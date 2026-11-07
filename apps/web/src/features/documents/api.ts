import {
  ALLOWED_UPLOAD_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_MB,
  DOCUMENT_OWNER_KEYS,
  type DocKind,
  type DocumentOwnerKey,
  type DocumentUpdate,
  type Locale,
} from '@renawi/shared';
import { asItems } from '../../shared/lib/collections';
import { http } from '../../shared/lib/http';
import type { DocumentItem, DocumentOwner } from './types';

/** The single `[key, id]` pair of an owner (throws when it is not exactly one). */
export function ownerEntry(owner: DocumentOwner): [DocumentOwnerKey, string] {
  const entries = DOCUMENT_OWNER_KEYS.flatMap((key) => {
    const id = owner[key];
    return id ? [[key, id] as [DocumentOwnerKey, string]] : [];
  });
  if (entries.length !== 1 || !entries[0]) {
    throw new Error('A document owner needs exactly one id');
  }
  return entries[0];
}

/** `GET /api/documents?<owner>Id=...` */
export async function fetchDocuments(
  owner: DocumentOwner,
  signal?: AbortSignal,
): Promise<DocumentItem[]> {
  const [key, id] = ownerEntry(owner);
  const res = await http.get<DocumentItem[] | { items: DocumentItem[] }>('/documents', {
    query: { [key]: id },
    signal,
  });
  return asItems(res);
}

export interface UploadDocumentInput {
  owner: DocumentOwner;
  file: File;
  kind: DocKind;
  title?: string | null;
  expiresAt?: string | null;
  lang?: Locale | null;
}

/** `POST /api/documents` as multipart: `file` + metadata + exactly one owner id. */
export function uploadDocument(input: UploadDocumentInput): Promise<DocumentItem> {
  const [key, id] = ownerEntry(input.owner);
  const form = new FormData();
  form.append('file', input.file, input.file.name);
  form.append('kind', input.kind);
  if (input.title) form.append('title', input.title);
  if (input.expiresAt) form.append('expiresAt', input.expiresAt);
  if (input.lang) form.append('lang', input.lang);
  form.append(key, id);
  return http.post<DocumentItem>('/documents', form);
}

/** `PATCH /api/documents/:id` */
export function updateDocument(id: string, body: DocumentUpdate): Promise<DocumentItem> {
  return http.patch<DocumentItem>(`/documents/${encodeURIComponent(id)}`, body);
}

/** `DELETE /api/documents/:id` */
export function deleteDocument(id: string): Promise<void> {
  return http.delete<void>(`/documents/${encodeURIComponent(id)}`);
}

/** File URL for inline viewing, or as an attachment download. */
export function documentFileUrl(doc: DocumentItem, download = false): string {
  const base = doc.url || `/api/documents/${encodeURIComponent(doc.id)}/file`;
  if (!download) return base;
  return `${base}${base.includes('?') ? '&' : '?'}download=1`;
}

export const MAX_UPLOAD_BYTES = DEFAULT_MAX_UPLOAD_MB * 1024 * 1024;

/** Client-side pre-check mirroring the API (413 / 415); returns an i18n error key or null. */
export function checkUpload(file: File): 'errors.fileTooLarge' | 'errors.unsupportedFileType' | null {
  if (file.size > MAX_UPLOAD_BYTES) return 'errors.fileTooLarge';
  if (file.type && !(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'errors.unsupportedFileType';
  }
  return null;
}

export function isImage(doc: Pick<DocumentItem, 'mime'>): boolean {
  return doc.mime.startsWith('image/');
}

export function isPdf(doc: Pick<DocumentItem, 'mime'>): boolean {
  return doc.mime === 'application/pdf';
}
