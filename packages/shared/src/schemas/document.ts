import { z } from 'zod';
import { DocKind, Locale } from '../enums.js';
import {
  idString,
  isoDate,
  optionalIsoDate,
  optionalText,
  pagination,
  queryList,
} from '../primitives.js';

/** Upload allow-list (validated server-side by magic bytes, not only the declared type). */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];
export const DEFAULT_MAX_UPLOAD_MB = 20;

/**
 * i18n key (namespace `common`): a document must hang on exactly one owner record
 * (`POST /documents`; `GET /documents` accepts at most one owner filter).
 */
export const DOCUMENT_ONE_OWNER_REQUIRED = 'validation.oneOwnerRequired';

/** Foreign keys a document can hang on; exactly one is set per document. */
export const DOCUMENT_OWNER_KEYS = [
  'vehicleId',
  'driverId',
  'contactId',
  'dealId',
  'contractId',
  'taxiLicenseId',
  'expenseId',
  'ledgerEntryId',
] as const;
export type DocumentOwnerKey = (typeof DOCUMENT_OWNER_KEYS)[number];

const ownerFields = {
  vehicleId: idString.optional(),
  driverId: idString.optional(),
  contactId: idString.optional(),
  dealId: idString.optional(),
  contractId: idString.optional(),
  taxiLicenseId: idString.optional(),
  expenseId: idString.optional(),
  ledgerEntryId: idString.optional(),
};

function countOwners(v: Partial<Record<DocumentOwnerKey, string | undefined>>): number {
  return DOCUMENT_OWNER_KEYS.filter((k) => v[k] !== undefined && v[k] !== '').length;
}

/**
 * `POST /documents` (multipart): metadata fields sent next to the `file` part. Multipart values
 * arrive as strings, so `lang`/`expiresAt` accept '' as "not set".
 */
export const DocumentCreateSchema = z
  .object({
    ...ownerFields,
    kind: DocKind,
    title: optionalText(200),
    lang: z.union([Locale, z.literal('').transform(() => null)]).nullish(),
    expiresAt: optionalIsoDate,
  })
  .refine((v) => countOwners(v) === 1, {
    message: DOCUMENT_ONE_OWNER_REQUIRED,
    path: ['vehicleId'],
  });
export type DocumentCreate = z.infer<typeof DocumentCreateSchema>;
export type DocumentCreateInput = z.input<typeof DocumentCreateSchema>;
/** Alias: the upload metadata schema. */
export const DocumentUploadSchema = DocumentCreateSchema;

/** `PATCH /documents/:id` (the owner cannot change). */
export const DocumentUpdateSchema = z
  .object({
    kind: DocKind,
    title: optionalText(200),
    lang: Locale.nullable(),
    expiresAt: optionalIsoDate,
  })
  .partial();
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;
export type DocumentUpdateInput = z.input<typeof DocumentUpdateSchema>;

/** `GET /documents?<owner>Id=...` (exactly one owner filter). */
export const DocumentQuerySchema = pagination
  .extend({
    ...ownerFields,
    kind: queryList(DocKind).optional(),
    /** Documents expiring on/before this date. */
    expiringBefore: isoDate.optional(),
  })
  .refine((v) => countOwners(v) <= 1, {
    message: DOCUMENT_ONE_OWNER_REQUIRED,
    path: ['vehicleId'],
  });
export type DocumentQuery = z.infer<typeof DocumentQuerySchema>;
