import { FeedSeverity, type FeedItem } from '@renawi/shared';
import type { TKey } from '../../../shared/lib/i18n';

/** Severities from the most to the least urgent (the order of every grouped list). */
export const SEVERITY_ORDER: readonly FeedSeverity[] = FeedSeverity.options;

export interface FeedGroup {
  severity: FeedSeverity;
  items: FeedItem[];
}

/**
 * Feed items grouped by severity, most urgent first; empty groups are left out and each group
 * keeps the API's order (by due date).
 */
export function groupFeedBySeverity(items: readonly FeedItem[]): FeedGroup[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    items: items.filter((item) => item.severity === severity),
  })).filter((group) => group.items.length > 0);
}

/** What the bell badge counts: overdue plus due items. */
export function attentionCount(counts: { overdue: number; due: number } | undefined): number {
  if (!counts) return 0;
  return Math.max(0, counts.overdue) + Math.max(0, counts.due);
}

/** Translation of a days-left value: `{ key, days }` for `t(key, { days })`. */
export function daysLeftLabel(daysLeft: number): { key: TKey; days: number } {
  if (daysLeft < -1) return { key: 'reminders.daysLeft.overdue', days: -daysLeft };
  if (daysLeft === -1) return { key: 'reminders.daysLeft.yesterday', days: 1 };
  if (daysLeft === 0) return { key: 'reminders.daysLeft.today', days: 0 };
  if (daysLeft === 1) return { key: 'reminders.daysLeft.tomorrow', days: 1 };
  return { key: 'reminders.daysLeft.left', days: daysLeft };
}

/** Is this feed item a manual reminder (it can be marked done from the feed)? */
export function isManualItem(item: Pick<FeedItem, 'kind' | 'entityType'>): boolean {
  return item.kind === 'manual' && item.entityType === 'reminder';
}

/**
 * A feed link is an SPA path from the API (`/vehicles/<id>`). Anything else (an absolute URL, a
 * protocol-relative path) is not followed.
 */
export function safeFeedLink(link: string | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
  return link;
}
