import type {
  EntityType,
  FeedKind,
  FeedSeverity,
  Paginated,
  RemindersFeed,
  ReminderCreate,
  ReminderUpdate,
  ReminderView,
} from '@renawi/shared';
import { http } from '../../shared/lib/http';

/** `GET /reminders/feed` parameters (lists travel comma-separated). */
export interface FeedQuery {
  /** Look-ahead in days (API default 30). */
  days?: number;
  kinds?: readonly FeedKind[];
  severity?: readonly FeedSeverity[];
  page?: number;
  pageSize?: number;
}

const list = (values: readonly string[] | undefined) =>
  values && values.length > 0 ? values.join(',') : undefined;

/**
 * `GET /api/reminders/feed?days&kinds&severity&page&pageSize`: every expiry, deadline and open
 * manual reminder up to `days` ahead (overdue included), sorted by due date, with counts per
 * severity (before the severity filter).
 */
export function fetchFeed(query: FeedQuery, signal?: AbortSignal): Promise<RemindersFeed> {
  return http.get<RemindersFeed>('/reminders/feed', {
    query: {
      days: query.days,
      kinds: list(query.kinds),
      severity: list(query.severity),
      page: query.page,
      pageSize: query.pageSize,
    },
    signal,
  });
}

/** `GET /reminders` parameters (manual reminders). */
export interface ReminderListQuery {
  /** `false` = open only; omitted = open and done. */
  done?: boolean;
  entityType?: EntityType;
  entityId?: string;
  page?: number;
  pageSize?: number;
}

/** `GET /api/reminders?done&entityType&entityId&page&pageSize` */
export function fetchReminders(
  query: ReminderListQuery,
  signal?: AbortSignal,
): Promise<Paginated<ReminderView>> {
  return http.get<Paginated<ReminderView>>('/reminders', { query: { ...query }, signal });
}

const reminderPath = (id: string) => `/reminders/${encodeURIComponent(id)}`;

/** `POST /api/reminders { title, dueAt, entityType?, entityId?, notes? }` */
export function createReminder(body: ReminderCreate): Promise<ReminderView> {
  return http.post<ReminderView>('/reminders', body);
}

/** `PATCH /api/reminders/:id` */
export function updateReminder(id: string, body: ReminderUpdate): Promise<ReminderView> {
  return http.patch<ReminderView>(reminderPath(id), body);
}

/** `POST /api/reminders/:id/done` */
export function markReminderDone(id: string): Promise<ReminderView> {
  return http.post<ReminderView>(`${reminderPath(id)}/done`);
}

/** `POST /api/reminders/:id/undone` */
export function markReminderUndone(id: string): Promise<ReminderView> {
  return http.post<ReminderView>(`${reminderPath(id)}/undone`);
}

/** `DELETE /api/reminders/:id` */
export function deleteReminder(id: string): Promise<void> {
  return http.delete<void>(reminderPath(id));
}
