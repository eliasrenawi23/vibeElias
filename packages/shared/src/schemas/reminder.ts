import { z } from 'zod';
import { EntityType, ReminderKind } from '../enums.js';
import {
  idString,
  isoDate,
  optionalText,
  pagination,
  queryBool,
  queryList,
} from '../primitives.js';

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

/** `GET /reminders/feed?days`: union of expiries, deadlines, follow-ups and manual reminders. */
export const ReminderFeedQuerySchema = z.object({
  /** Look-ahead window; each kind is further limited by `Settings.reminderLeadDays`. */
  days: z.coerce.number().int().min(1).max(365).default(60),
  kind: queryList(ReminderKind).optional(),
  /** Include overdue items (default true). */
  includeOverdue: queryBool.default(true),
});
export type ReminderFeedQuery = z.infer<typeof ReminderFeedQuerySchema>;

export const ReminderSeverity = z.enum(['overdue', 'soon', 'upcoming']);
export type ReminderSeverity = z.infer<typeof ReminderSeverity>;

/** One item of the reminders feed. */
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
