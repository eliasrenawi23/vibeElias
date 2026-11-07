import { z } from 'zod';
import { DriverStatus } from '../enums.js';
import { msg } from '../messages.js';
import {
  idString,
  isoDate,
  optionalIsoDate,
  optionalPhone,
  optionalText,
  pagination,
  queryBool,
  queryList,
  querySearch,
} from '../primitives.js';
import { ContactCreateSchema, ContactUpdateSchema } from './contact.js';

const DriverFieldsSchema = z.object({
  /** D1 driving licence number. */
  licenseNo: optionalText(30),
  licenseExpiry: optionalIsoDate,
  taxiPermitNo: optionalText(30),
  taxiPermitExpiry: optionalIsoDate,
  medicalExpiry: optionalIsoDate,
  emergencyName: optionalText(100),
  emergencyPhone: optionalPhone,
  startedAt: optionalIsoDate,
  status: DriverStatus.default('ACTIVE'),
  notes: optionalText(5000),
});

/**
 * `POST /drivers`: either link an existing contact (`contactId`) or create one inline
 * (`contact`); exactly one of them. The DRIVER tag is added to the contact server-side.
 */
export const DriverCreateSchema = DriverFieldsSchema.extend({
  contactId: idString.optional(),
  contact: ContactCreateSchema.optional(),
}).superRefine((v, ctx) => {
  if ((v.contactId === undefined) === (v.contact === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contactId'],
      message: msg.contactRequired,
    });
  }
});
export type DriverCreate = z.infer<typeof DriverCreateSchema>;
export type DriverCreateInput = z.input<typeof DriverCreateSchema>;

/** `PATCH /drivers/:id`. `contact` optionally updates the linked contact in the same call. */
export const DriverUpdateSchema = DriverFieldsSchema.partial().extend({
  contact: ContactUpdateSchema.optional(),
});
export type DriverUpdate = z.infer<typeof DriverUpdateSchema>;
export type DriverUpdateInput = z.input<typeof DriverUpdateSchema>;

/** `GET /drivers` */
export const DriverQuerySchema = pagination.extend({
  /** Matches contact name, phone, ID number, licence numbers. */
  q: querySearch.optional(),
  status: queryList(DriverStatus).optional(),
  /** Only drivers with (true) / without (false) an ACTIVE lease. */
  hasActiveLease: queryBool.optional(),
  /** Licence, permit or medical expiring on/before this date. */
  expiringBefore: isoDate.optional(),
  /** Only drivers who owe money (ledger balance > 0). */
  withBalanceOnly: queryBool.optional(),
});
export type DriverQuery = z.infer<typeof DriverQuerySchema>;
