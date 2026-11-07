import {
  ContactCreateSchema,
  DriverCreateSchema,
  idString,
  msg,
  optionalPhone,
  type ContactCreate,
} from '@renawi/shared';
import { z } from 'zod';
import type { DriverCreateBody, DriverFieldsBody } from '../api';
import type { Driver } from '../types';

/** Driver columns (licence, permit, medical, emergency contact, start date, status, notes). */
export const DriverFieldsSchema = DriverCreateSchema.innerType().omit({
  contactId: true,
  contact: true,
});
export type DriverFieldsInput = z.input<typeof DriverFieldsSchema>;
export type DriverFieldsOutput = z.output<typeof DriverFieldsSchema>;

/** The new contact typed inline on `/drivers/new`. */
const InlineContactSchema = ContactCreateSchema.innerType()
  .pick({ firstName: true, lastName: true, idNumber: true, email: true, preferredLang: true })
  .extend({ phone: optionalPhone });

export const CONTACT_MODES = ['existing', 'new'] as const;
export type ContactMode = (typeof CONTACT_MODES)[number];

/** `/drivers/new`: step 1 picks or creates the contact, step 2 holds the driver fields. */
export const DriverNewFormSchema = DriverFieldsSchema.extend({
  contactMode: z.enum(CONTACT_MODES),
  contactId: idString.nullish(),
  contact: InlineContactSchema,
}).superRefine((v, ctx) => {
  if (v.contactMode === 'existing' && !v.contactId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactId'],
      message: msg.contactRequired,
    });
  }
  if (v.contactMode === 'new' && !v.contact.firstName && !v.contact.lastName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contact', 'firstName'],
      message: msg.nameRequired,
    });
  }
});
export type DriverNewFormInput = z.input<typeof DriverNewFormSchema>;
export type DriverNewFormOutput = z.output<typeof DriverNewFormSchema>;

/** Form values of the driver columns (nulls become '' for the text inputs). */
export function toDriverFieldValues(d?: Driver | null): DriverFieldsInput {
  return {
    licenseNo: d?.licenseNo ?? '',
    licenseExpiry: d?.licenseExpiry ?? null,
    taxiPermitNo: d?.taxiPermitNo ?? '',
    taxiPermitExpiry: d?.taxiPermitExpiry ?? null,
    medicalExpiry: d?.medicalExpiry ?? null,
    emergencyName: d?.emergencyName ?? '',
    emergencyPhone: d?.emergencyPhone ?? '',
    startedAt: d?.startedAt ?? null,
    status: d?.status ?? 'ACTIVE',
    notes: d?.notes ?? '',
  };
}

/** Parsed driver columns to the API body (undefined -> null). */
export function toDriverFieldsBody(v: DriverFieldsOutput): DriverFieldsBody {
  return {
    licenseNo: v.licenseNo ?? null,
    licenseExpiry: v.licenseExpiry ?? null,
    taxiPermitNo: v.taxiPermitNo ?? null,
    taxiPermitExpiry: v.taxiPermitExpiry ?? null,
    medicalExpiry: v.medicalExpiry ?? null,
    emergencyName: v.emergencyName ?? null,
    emergencyPhone: v.emergencyPhone ?? null,
    startedAt: v.startedAt ?? null,
    status: v.status,
    notes: v.notes ?? null,
  };
}

/** `POST /drivers` body: `{ contactId }` or `{ contact }` (tagged DRIVER) plus the driver columns. */
export function toDriverCreateBody(v: DriverNewFormOutput): DriverCreateBody {
  const { contactMode, contactId, contact, ...fields } = v;
  const driver = toDriverFieldsBody(fields);
  if (contactMode === 'existing') return { ...driver, contactId: contactId ?? '' };
  const newContact: ContactCreate = {
    tags: ['DRIVER'],
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    idNumber: contact.idNumber ?? null,
    phones: contact.phone ? [contact.phone] : [],
    email: contact.email ?? null,
    preferredLang: contact.preferredLang,
  };
  return { ...driver, contact: newContact };
}
