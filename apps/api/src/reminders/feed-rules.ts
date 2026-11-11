import {
  addDays,
  addMonths,
  DEALER_REGISTRATION_ALERT_MONTHS,
  diffDays,
  FEED_KIND_LEAD_DAYS_KEY,
  FeedKind,
  taxiAgeStatus,
  type EntityType,
  type FeedCounts,
  type FeedEntityType,
  type FeedItem,
  type FeedSeverity,
  type ReminderLeadDays,
  type RemindersFeed,
} from '@renawi/shared';

/*
 * Pure rules of the reminders feed (`GET /reminders/feed`): lead days per kind, severity,
 * window, the computed due dates (dealer registration, taxi age) and the final assembly
 * (sort, counts, filters, pagination). No I/O; the feed service collects the candidates.
 */

/** Lead days of a feed kind from `Settings.reminderLeadDays` (0 = due on the day itself). */
export function leadDaysOf(kind: FeedKind, lead: ReminderLeadDays): number {
  const key = FEED_KIND_LEAD_DAYS_KEY[kind];
  return key ? lead[key] : 0;
}

/**
 * Severity of an item due on `dueAt`: `overdue` once the date has passed, `due` from
 * `leadDays` before the date until the date itself (today included), else `upcoming`.
 */
export function feedSeverity(dueAt: string, today: string, leadDays: number): FeedSeverity {
  const daysLeft = diffDays(today, dueAt);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= leadDays) return 'due';
  return 'upcoming';
}

/**
 * Last due date shown for a kind: `days` ahead, but never less than the kind's lead days (an
 * item inside its lead days is always listed). Overdue items have no lower bound.
 */
export function feedHorizon(today: string, days: number, leadDays: number): string {
  return addDays(today, Math.max(days, leadDays));
}

/**
 * Feed date of the dealer-registration cap: 11 months after `dealerRegisteredAt` (the alert
 * month of the 12-month cap; `dealerRegistrationStatus().expiresAt` is the cap itself).
 */
export function dealerRegistrationDueAt(dealerRegisteredAt: string): string {
  return addMonths(dealerRegisteredAt, DEALER_REGISTRATION_ALERT_MONTHS);
}

/**
 * Taxi age dates from the manufacture year (same calendar-year rule as `taxiAgeStatus`):
 * `blockedFrom` = 1 January of year + 12 (no taxi licence any more), `semiAnnualFrom` =
 * 1 January of year + 10 (semi-annual test regime).
 */
export function taxiAgeDates(year: number): { semiAnnualFrom: string; blockedFrom: string } {
  const status = taxiAgeStatus(year, `${year}-01-01`);
  return { semiAnnualFrom: status.semiAnnualFrom, blockedFrom: status.blockedFrom };
}

/** A dated item before classification (what the collectors produce). */
export interface FeedCandidate {
  kind: FeedKind;
  entityType: FeedEntityType;
  entityId: string;
  title: string;
  subtitle: string | null;
  dueAt: string;
  link: string;
}

export interface FeedOptions {
  today: string;
  days: number;
  lead: ReminderLeadDays;
  kinds?: readonly FeedKind[];
  severity?: readonly FeedSeverity[];
  page: number;
  pageSize: number;
}

const KIND_ORDER: ReadonlyMap<FeedKind, number> = new Map(FeedKind.options.map((k, i) => [k, i]));

/** Stable composite id of a feed item: `<kind>:<entityId>`. */
export function feedItemId(kind: FeedKind, entityId: string): string {
  return `${kind}:${entityId}`;
}

/** Classifies one candidate; null when it falls outside the window. */
export function toFeedItem(c: FeedCandidate, o: Pick<FeedOptions, 'today' | 'days' | 'lead'>) {
  const lead = leadDaysOf(c.kind, o.lead);
  if (c.dueAt > feedHorizon(o.today, o.days, lead)) return null;
  const item: FeedItem = {
    id: feedItemId(c.kind, c.entityId),
    kind: c.kind,
    entityType: c.entityType,
    entityId: c.entityId,
    title: c.title,
    subtitle: c.subtitle,
    dueAt: c.dueAt,
    daysLeft: diffDays(o.today, c.dueAt),
    severity: feedSeverity(c.dueAt, o.today, lead),
    link: c.link,
  };
  return item;
}

export function compareFeedItems(a: FeedItem, b: FeedItem): number {
  if (a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
  const k = (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0);
  if (k !== 0) return k;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Builds the feed response: classify + window, `kinds` filter, counts (before the severity
 * filter), `severity` filter, sort by `dueAt` ascending, pagination. Duplicate ids keep the
 * first candidate.
 */
export function assembleFeed(candidates: readonly FeedCandidate[], o: FeedOptions): RemindersFeed {
  const kinds = o.kinds?.length ? new Set(o.kinds) : null;
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const c of candidates) {
    if (kinds && !kinds.has(c.kind)) continue;
    const item = toFeedItem(c, o);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  const counts: FeedCounts = { overdue: 0, due: 0, upcoming: 0 };
  for (const item of items) counts[item.severity] += 1;
  const severities = o.severity?.length ? new Set(o.severity) : null;
  const matching = (severities ? items.filter((i) => severities.has(i.severity)) : items).sort(
    compareFeedItems,
  );
  const start = (o.page - 1) * o.pageSize;
  return {
    items: matching.slice(start, start + o.pageSize),
    total: matching.length,
    page: o.page,
    pageSize: o.pageSize,
    counts,
  };
}

/** SPA path of an entity a manual reminder links to (`/reminders` when it has no page). */
export function reminderEntityLink(
  entityType: EntityType | null | undefined,
  entityId: string | null | undefined,
): string {
  if (!entityType || !entityId) return '/reminders';
  const id = encodeURIComponent(entityId);
  switch (entityType) {
    case 'VEHICLE':
      return `/vehicles/${id}`;
    case 'TAXI_LICENSE':
      return `/taxi-licenses/${id}`;
    case 'DRIVER':
      return `/drivers/${id}`;
    case 'CONTACT':
      return `/contacts/${id}`;
    case 'LEASE':
      return `/leases/${id}`;
    case 'DEAL':
      return `/deals/${id}`;
    case 'FINE':
      return '/fines';
    case 'INSURANCE':
      return '/vehicles?tab=insurance';
    default:
      return '/reminders';
  }
}
