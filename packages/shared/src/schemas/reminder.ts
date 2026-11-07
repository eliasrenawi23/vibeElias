import { z } from 'zod';
import { EntityType, FeedEntityType, FeedKind, FeedSeverity, ReminderKind } from '../enums.js';
import {
  idString,
  isoDate,
  isoDateTime,
  optionalText,
  pagination,
  queryBool,
  queryList,
} from '../primitives.js';
import type { ReminderLeadDays } from './settings.js';

const ReminderBaseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: isoDate,
  /** Optional link to an entity (shown as a link in the feed). */
  entityType: EntityType.nullish(),
  entityId: idString.nullish(),
  notes: optionalText(2000),
});

/** `POST /reminders` (manual reminder). */
export const ReminderCreateSchema = ReminderBaseSchema;
export type ReminderCreate = z.infer<typeof ReminderCreateSchema>;
export type ReminderCreateInput = z.input<typeof ReminderCreateSchema>;

/** `PATCH /reminders/:id` (`POST /reminders/:id/done` marks it done). */
export const ReminderUpdateSchema = ReminderBaseSchema.partial();
export type ReminderUpdate = z.infer<typeof ReminderUpdateSchema>;
export type ReminderUpdateInput = z.input<typeof ReminderUpdateSchema>;

/** `GET /reminders` (manual reminders). */
export const ReminderQuerySchema = pagination.extend({
  done: queryBool.optional(),
  dueBefore: isoDate.optional(),
  entityType: EntityType.optional(),
  entityId: idString.optional(),
});
export type ReminderQuery = z.infer<typeof ReminderQuerySchema>;

/**
 * @deprecated Pre-milestone-5 draft of the feed query; the API uses `RemindersFeedQuerySchema`.
 */
export const ReminderFeedQuerySchema = z.object({
  /** Look-ahead window; each kind is further limited by `Settings.reminderLeadDays`. */
  days: z.coerce.number().int().min(1).max(365).default(60),
  kind: queryList(ReminderKind).optional(),
  /** Include overdue items (default true). */
  includeOverdue: queryBool.default(true),
});
export type ReminderFeedQuery = z.infer<typeof ReminderFeedQuerySchema>;

/** @deprecated Pre-milestone-5 draft; the feed uses `FeedSeverity` (overdue / due / upcoming). */
export const ReminderSeverity = z.enum(['overdue', 'soon', 'upcoming']);
export type ReminderSeverity = z.infer<typeof ReminderSeverity>;

/** @deprecated Pre-milestone-5 draft of a feed item; the API returns `FeedItemSchema`. */
export const ReminderFeedItemSchema = z.object({
  /** Stable key, e.g. `INSURANCE:<policyId>`. */
  key: z.string(),
  kind: ReminderKind,
  dueAt: isoDate,
  /** Negative when overdue. */
  daysLeft: z.number().int(),
  severity: ReminderSeverity,
  title: z.string(),
  entityType: EntityType.nullable(),
  entityId: idString.nullable(),
  /** Manual reminder id (kind MANUAL). */
  reminderId: idString.nullable(),
});
export type ReminderFeedItem = z.infer<typeof ReminderFeedItemSchema>;

/* ------------------------------------------------------------------------------------------ */
/* Reminders feed (milestone 5)                                                               */
/* ------------------------------------------------------------------------------------------ */

/**
 * `Settings.reminderLeadDays` key that sets the "due" window of each feed kind. `null` = the date
 * was chosen by the user (follow-ups, manual reminders): due on the day itself, no lead.
 */
export const FEED_KIND_LEAD_DAYS_KEY: Readonly<Record<FeedKind, keyof ReminderLeadDays | null>> =
  Object.freeze({
    vehicleRegistration: 'registration',
    insurance: 'insurance',
    driverLicense: 'driverLicense',
    taxiPermit: 'taxiPermit',
    medical: 'medical',
    taxiLicenseFee: 'taxiLicense',
    taxiLicenseRenewal: 'taxiLicense',
    leaseEnd: 'lease',
    document: 'document',
    contactFollowUp: null,
    fineReassign: 'fine',
    dealTransfer: 'transfer',
    dealerRegistration: 'dealerRegistration',
    taxiAge: 'taxiAge',
    taxiSemiAnnual: 'taxiAge',
    manual: null,
  });

/**
 * `GET /reminders/feed`: every expiry, deadline, follow-up and open manual reminder up to `days`
 * ahead (items inside their kind's lead days are always included), overdue ones included.
 * `kinds` / `severity` accept one value, a comma-separated list or repeated params.
 */
export const RemindersFeedQuerySchema = pagination
  .pick({ page: true, pageSize: true })
  .extend({
    days: z.coerce.number().int().min(1).max(365).default(30),
    kinds: queryList(FeedKind).optional(),
    severity: queryList(FeedSeverity).optional(),
  });
export type RemindersFeedQuery = z.infer<typeof RemindersFeedQuerySchema>;
export type RemindersFeedQueryInput = z.input<typeof RemindersFeedQuerySchema>;

/** One item of `GET /reminders/feed`. */
export const FeedItemSchema = z.object({
  /** Stable composite key, e.g. `vehicle:registration:<vehicleId>`, `reminder:manual:<id>`. */
  id: z.string(),
  kind: FeedKind,
  entityType: FeedEntityType,
  /** Id of the entity (`reminder` items: the manual reminder id, for done / undone). */
  entityId: idString,
  /** Display name of the entity (plate + make / model, person, licence no., document title...). */
  title: z.string(),
  /** Secondary detail (data, not translated), e.g. insurer + policy no.; null when none. */
  subtitle: z.string().nullable(),
  dueAt: isoDate,
  /** `dueAt - today` in days; negative when overdue. */
  daysLeft: z.number().int(),
  severity: FeedSeverity,
  /** SPA path of the entity, e.g. `/vehicles/<id>`. */
  link: z.string(),
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

/** Item counts per severity (after `days` / `kinds`, before `severity` and pagination). */
export const FeedCountsSchema = z.object({
  overdue: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  upcoming: z.number().int().nonnegative(),
});
export type FeedCounts = z.infer<typeof FeedCountsSchema>;

/** `GET /reminders/feed` response (sorted by `dueAt` ascending). */
export const RemindersFeedSchema = z.object({
  items: z.array(FeedItemSchema),
  /** Items matching every filter (all pages). */
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  counts: FeedCountsSchema,
});
export type RemindersFeed = z.infer<typeof RemindersFeedSchema>;

/** Manual reminder on the wire (`GET /reminders` item and every reminder action). */
export const ReminderSchema = z.object({
  id: idString,
  title: z.string(),
  dueAt: isoDate,
  entityType: EntityType.nullable(),
  entityId: idString.nullable(),
  notes: z.string().nullable(),
  doneAt: isoDateTime.nullable(),
  createdAt: isoDateTime,
  /** SPA path of the linked entity (`/reminders` when there is none). */
  link: z.string(),
});
export type ReminderView = z.infer<typeof ReminderSchema>;
