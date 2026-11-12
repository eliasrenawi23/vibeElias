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

/* ------------------------------------------------------------------------------------------ */
/* Generated PDFs (milestone 6)                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * Printable documents rendered by `POST /pdf/:template/:id?lang=` (stored as a Document) and
 * previewed as HTML by `GET /pdf/:template/:id/preview?lang=`. The `:id` per template:
 * - lease-contract, handover, return: lease contract id (`return` uses `returnChecklist`)
 * - deposit-receipt: ledger entry id of a DEPOSIT_IN / DEPOSIT_OUT
 * - payment-confirmation: ledger entry id of a PAYMENT, or a deal payment id
 * - sale-agreement: SALE / CONSIGNMENT_SALE deal id; purchase-agreement: PURCHASE deal id
 * - consignment-agreement: CONSIGNED inventory cycle id
 * - disclosure-form: SALE / CONSIGNMENT_SALE deal id
 */
export const PdfTemplate = z.enum([
  'lease-contract',
  'handover',
  'return',
  'deposit-receipt',
  'payment-confirmation',
  'sale-agreement',
  'purchase-agreement',
  'consignment-agreement',
  'disclosure-form',
]);
export type PdfTemplate = z.infer<typeof PdfTemplate>;

/** `Document.kind` of the stored PDF per template. */
export const PDF_TEMPLATE_DOC_KINDS: Readonly<Record<PdfTemplate, DocKind>> = Object.freeze({
  'lease-contract': 'CONTRACT',
  handover: 'HANDOVER',
  return: 'HANDOVER',
  'deposit-receipt': 'RECEIPT',
  'payment-confirmation': 'RECEIPT',
  'sale-agreement': 'AGREEMENT',
  'purchase-agreement': 'AGREEMENT',
  'consignment-agreement': 'AGREEMENT',
  'disclosure-form': 'DISCLOSURE_FORM',
});

/**
 * Owner foreign key of the stored PDF per template (`payment-confirmation` of a deal payment
 * hangs on its deal: `dealId`).
 */
export const PDF_TEMPLATE_OWNERS: Readonly<Record<PdfTemplate, readonly DocumentOwnerKey[]>> =
  Object.freeze({
    'lease-contract': ['contractId'],
    handover: ['contractId'],
    return: ['contractId'],
    'deposit-receipt': ['ledgerEntryId'],
    'payment-confirmation': ['ledgerEntryId', 'dealId'],
    'sale-agreement': ['dealId'],
    'purchase-agreement': ['dealId'],
    'consignment-agreement': ['vehicleId'],
    'disclosure-form': ['dealId'],
  });

/** i18n keys (namespace `common`, web) of the template display names: `pdf.templates.<key>`. */
export const PDF_TEMPLATE_TITLE_KEYS: Readonly<Record<PdfTemplate, string>> = Object.freeze({
  'lease-contract': 'pdf.templates.leaseContract',
  handover: 'pdf.templates.handover',
  return: 'pdf.templates.return',
  'deposit-receipt': 'pdf.templates.depositReceipt',
  'payment-confirmation': 'pdf.templates.paymentConfirmation',
  'sale-agreement': 'pdf.templates.saleAgreement',
  'purchase-agreement': 'pdf.templates.purchaseAgreement',
  'consignment-agreement': 'pdf.templates.consignmentAgreement',
  'disclosure-form': 'pdf.templates.disclosureForm',
});

/** i18n key of the 409 returned when a template does not fit the entity. */
export const PDF_NOT_APPLICABLE = 'errors.pdfNotApplicable';

/**
 * `POST /pdf/:template/:id` and `GET /pdf/:template/:id/preview`: document language (default:
 * the counterparty's `preferredLang`, else the user's locale).
 */
export const PdfQuerySchema = z.object({
  lang: Locale.optional(),
});
export type PdfQuery = z.infer<typeof PdfQuerySchema>;
