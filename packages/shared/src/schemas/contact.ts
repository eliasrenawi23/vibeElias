import { z } from 'zod';
import { ContactTag, Locale } from '../enums.js';
import { msg } from '../messages.js';
import {
  isoDate,
  optionalEmail,
  optionalIdNumber,
  optionalIsoDate,
  optionalText,
  pagination,
  phone,
  queryBool,
  queryList,
  querySearch,
} from '../primitives.js';

const ContactBaseSchema = z.object({
  tags: z.array(ContactTag).max(ContactTag.options.length).default([]),
  firstName: optionalText(100),
  lastName: optionalText(100),
  companyName: optionalText(200),
  /** Israeli ID (teudat zehut) or company number, check-digit validated. */
  idNumber: optionalIdNumber,
  /** Canonical national digits; first entry is the primary number. */
  phones: z.array(phone).max(5).default([]),
  email: optionalEmail,
  address: optionalText(300),
  city: optionalText(100),
  preferredLang: Locale.default('he'),
  /** Lead source (yad2, referral, walk-in...). */
  source: optionalText(100),
  notes: optionalText(5000),
  followUpAt: optionalIsoDate,
});

function hasName(v: {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}) {
  return Boolean(v.firstName || v.lastName || v.companyName);
}

/** `POST /contacts`. At least one of firstName / lastName / companyName is required. */
export const ContactCreateSchema = ContactBaseSchema.refine(hasName, {
  message: msg.nameRequired,
  path: ['firstName'],
});
export type ContactCreate = z.infer<typeof ContactCreateSchema>;
export type ContactCreateInput = z.input<typeof ContactCreateSchema>;

/** `PATCH /contacts/:id` (archive via `POST /contacts/:id/archive`). */
export const ContactUpdateSchema = ContactBaseSchema.partial();
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;
export type ContactUpdateInput = z.input<typeof ContactUpdateSchema>;

/** `GET /contacts?q&tag&followUpBefore` */
export const ContactQuerySchema = pagination.extend({
  /** Matches name, company, phone, ID number, email. */
  q: querySearch.optional(),
  tag: queryList(ContactTag).optional(),
  /** Follow-up date on/before (leads to call). */
  followUpBefore: isoDate.optional(),
  includeArchived: queryBool.default(false),
  /**
   * `false` = active contacts only, `true` = archived only. Omitted -> active only, unless
   * `includeArchived=true` (then both).
   */
  archived: queryBool.optional(),
});
export type ContactQuery = z.infer<typeof ContactQuerySchema>;

/** `POST /contacts/:id/archive` (`archived: false` restores). */
export const ContactArchiveSchema = z.object({
  archived: z.boolean().default(true),
});
export type ContactArchive = z.infer<typeof ContactArchiveSchema>;

/** Display name of a contact: "first last", else the company name, else ''. */
export function contactDisplayName(c: {
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}): string {
  const person = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return person || c.companyName?.trim() || '';
}
