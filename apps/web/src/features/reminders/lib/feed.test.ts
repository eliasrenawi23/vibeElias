import { describe, expect, it } from 'vitest';
import { feedItem } from '../../../test/fixtures';
import {
  attentionCount,
  daysLeftLabel,
  groupFeedBySeverity,
  isManualItem,
  safeFeedLink,
} from './feed';

describe('feed helpers', () => {
  it('groups by severity, most urgent first, keeping the API order and dropping empty groups', () => {
    const items = [
      feedItem({ id: 'a', severity: 'upcoming', daysLeft: 40 }),
      feedItem({ id: 'b', severity: 'overdue', daysLeft: -3 }),
      feedItem({ id: 'c', severity: 'upcoming', daysLeft: 50 }),
      feedItem({ id: 'd', severity: 'overdue', daysLeft: -1 }),
    ];
    const groups = groupFeedBySeverity(items);
    expect(groups.map((g) => g.severity)).toEqual(['overdue', 'upcoming']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['b', 'd']);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(['a', 'c']);
    expect(groupFeedBySeverity([])).toEqual([]);
  });

  it('counts overdue + due for the bell', () => {
    expect(attentionCount({ overdue: 2, due: 3 })).toBe(5);
    expect(attentionCount({ overdue: 0, due: 0 })).toBe(0);
    expect(attentionCount(undefined)).toBe(0);
  });

  it('words the days left', () => {
    expect(daysLeftLabel(-5)).toEqual({ key: 'reminders.daysLeft.overdue', days: 5 });
    expect(daysLeftLabel(-1)).toEqual({ key: 'reminders.daysLeft.yesterday', days: 1 });
    expect(daysLeftLabel(0)).toEqual({ key: 'reminders.daysLeft.today', days: 0 });
    expect(daysLeftLabel(1)).toEqual({ key: 'reminders.daysLeft.tomorrow', days: 1 });
    expect(daysLeftLabel(12)).toEqual({ key: 'reminders.daysLeft.left', days: 12 });
  });

  it('recognises manual reminders and only follows in-app links', () => {
    expect(isManualItem(feedItem({ kind: 'manual', entityType: 'reminder' }))).toBe(true);
    expect(isManualItem(feedItem({ kind: 'insurance', entityType: 'insurance' }))).toBe(false);
    expect(safeFeedLink('/leases/lc_1')).toBe('/leases/lc_1');
    expect(safeFeedLink('https://evil.example')).toBeNull();
    expect(safeFeedLink('//evil.example')).toBeNull();
    expect(safeFeedLink(null)).toBeNull();
  });
});
