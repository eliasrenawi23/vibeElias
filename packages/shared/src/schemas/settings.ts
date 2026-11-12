import { z } from 'zod';
import { DEFAULT_VAT_RATE } from '../money.js';
import {
  idString,
  isoDateTime,
  optionalEmail,
  optionalIdNumber,
  optionalPhone,
  optionalText,
  percent,
} from '../primitives.js';
import { DEFAULT_RESPONSIBILITIES, ResponsibilitiesSchema } from './lease.js';

/** Text in the three UI languages. */
export const LocalizedTextSchema = z.object({
  he: z.string().trim().max(20_000),
  ar: z.string().trim().max(20_000),
  en: z.string().trim().max(20_000),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Business name in he/ar/en (each required). */
export const BusinessNameSchema = z.object({
  he: z.string().trim().min(1).max(200),
  ar: z.string().trim().min(1).max(200),
  en: z.string().trim().min(1).max(200),
});
export type BusinessName = z.infer<typeof BusinessNameSchema>;

export const BUSINESS_NAME: Readonly<BusinessName> = Object.freeze({
  he: 'רינאוי מוטורס',
  ar: 'ريناوي موتورز',
  en: 'Renawi Motors',
});

const leadDays = z.number().int().min(0).max(365);

/** Days before an expiry / deadline at which it enters the reminders feed. */
export const ReminderLeadDaysSchema = z.object({
  /** Vehicle licence / annual test (`Vehicle.registrationExpiry`). */
  registration: leadDays.default(30),
  /** Insurance policy end. */
  insurance: leadDays.default(30),
  /** Driver D1 licence. */
  driverLicense: leadDays.default(60),
  /** Taxi driver permit. */
  taxiPermit: leadDays.default(60),
  /** Driver medical certificate. */
  medical: leadDays.default(60),
  /** Taxi licence annual fee / renewal. */
  taxiLicense: leadDays.default(60),
  /** Lease contract end. */
  lease: leadDays.default(30),
  /** Document `expiresAt`. */
  document: leadDays.default(30),
  /** 12-month dealer registration cap. */
  dealerRegistration: leadDays.default(30),
  /** Ownership transfer due date (6 working days after a sale). */
  transfer: leadDays.default(2),
  /** Traffic-fine reassignment deadline (receivedAt + 90 days). */
  fine: leadDays.default(14),
  /** Taxi age dates: the 12-year limit and the 10-year semi-annual test regime. */
  taxiAge: leadDays.default(90),
});
export type ReminderLeadDays = z.infer<typeof ReminderLeadDaysSchema>;
export const REMINDER_LEAD_DAY_KEYS = Object.keys(
  ReminderLeadDaysSchema.shape,
) as (keyof ReminderLeadDays)[];
export const DEFAULT_REMINDER_LEAD_DAYS: Readonly<ReminderLeadDays> = Object.freeze(
  ReminderLeadDaysSchema.parse({}),
);

/** Defaults applied to new lease contracts. */
export const DefaultLeaseTermsSchema = z.object({
  responsibilities: ResponsibilitiesSchema.default({}),
  /** Standard contract clauses per language (rendered into the lease PDF). */
  clauses: LocalizedTextSchema.default({ he: '', ar: '', en: '' }),
});
export type DefaultLeaseTerms = z.infer<typeof DefaultLeaseTermsSchema>;
export const DEFAULT_LEASE_TERMS: Readonly<DefaultLeaseTerms> = Object.freeze({
  responsibilities: { ...DEFAULT_RESPONSIBILITIES },
  clauses: { he: '', ar: '', en: '' },
});

/** Business settings (singleton row `Settings.id = 1`): body of a full `PATCH /settings`. */
export const SettingsSchema = z.object({
  businessName: BusinessNameSchema,
  /** Company number / licensed-dealer (osek murshe) number, check-digit validated. */
  legalId: optionalIdNumber,
  /** Car dealer licence number (printed on sale contracts). */
  dealerLicenseNo: optionalText(50),
  address: optionalText(300),
  phone: optionalPhone,
  email: optionalEmail,
  /** VAT percent snapshot source, e.g. 18. */
  vatRate: percent.default(DEFAULT_VAT_RATE),
  reminderLeadDays: ReminderLeadDaysSchema,
  defaultLeaseTerms: DefaultLeaseTermsSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;
export type SettingsInput = z.input<typeof SettingsSchema>;

/** `PATCH /settings`: any subset of top-level fields (nested objects are replaced whole). */
export const SettingsUpdateSchema = SettingsSchema.partial();
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;
export type SettingsUpdateInput = z.input<typeof SettingsUpdateSchema>;

/** `GET /settings` response. */
export const SettingsResponseSchema = SettingsSchema.extend({
  logoDocumentId: idString.nullable(),
  updatedAt: isoDateTime,
});
export type SettingsResponse = z.infer<typeof SettingsResponseSchema>;

/** Values used by the seed and as fallback before the settings row exists. */
export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  businessName: { ...BUSINESS_NAME },
  legalId: null,
  dealerLicenseNo: null,
  address: null,
  phone: null,
  email: null,
  vatRate: DEFAULT_VAT_RATE,
  reminderLeadDays: { ...DEFAULT_REMINDER_LEAD_DAYS },
  defaultLeaseTerms: {
    responsibilities: { ...DEFAULT_RESPONSIBILITIES },
    clauses: { he: '', ar: '', en: '' },
  },
});

/**
 * `GET /settings/backup-status`: last successful nightly backup, read from the status file the
 * backup sidecar writes (`BACKUP_STATUS_FILE`). `ok` = a backup succeeded within the last
 * `BACKUP_MAX_AGE_HOURS` hours. `offsite` = that backup was also copied to the S3 bucket
 * (`false` = it stays on the server only; `null` = unknown, a status file of an older sidecar);
 * `remote` = where it was copied (`s3:<bucket>/<prefix>`), null otherwise.
 */
export const BackupStatusSchema = z.object({
  lastSuccessAt: isoDateTime.nullable(),
  lastFile: z.string().nullable(),
  ok: z.boolean(),
  offsite: z.boolean().nullable().optional(),
  remote: z.string().nullable().optional(),
});
export type BackupStatus = z.infer<typeof BackupStatusSchema>;

/** A backup older than this many hours makes `BackupStatus.ok` false (nightly job + slack). */
export const BACKUP_MAX_AGE_HOURS = 36;
