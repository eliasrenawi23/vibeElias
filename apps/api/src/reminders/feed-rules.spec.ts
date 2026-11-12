import { DEFAULT_REMINDER_LEAD_DAYS, FeedKind, type ReminderLeadDays } from '@renawi/shared';
import {
  assembleFeed,
  compareFeedItems,
  dealerRegistrationDueAt,
  feedHorizon,
  feedItemId,
  feedSeverity,
  leadDaysOf,
  reminderEntityLink,
  taxiAgeDates,
  toFeedItem,
  type FeedCandidate,
  type FeedOptions,
} from './feed-rules';

const T = '2026-11-12';
const LEAD: ReminderLeadDays = { ...DEFAULT_REMINDER_LEAD_DAYS };

function candidate(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    kind: 'vehicleRegistration',
    entityType: 'vehicle',
    entityId: 'v1',
    title: '312-45-625 · Toyota Corolla',
    subtitle: null,
    dueAt: T,
    link: '/vehicles/v1',
    ...over,
  };
}

function options(over: Partial<FeedOptions> = {}): FeedOptions {
  return { today: T, days: 30, lead: LEAD, page: 1, pageSize: 25, ...over };
}

describe('lead days per kind', () => {
  it('maps every kind to its Settings.reminderLeadDays key (user-chosen dates: 0)', () => {
    expect(leadDaysOf('vehicleRegistration', LEAD)).toBe(30);
    expect(leadDaysOf('insurance', LEAD)).toBe(30);
    expect(leadDaysOf('driverLicense', LEAD)).toBe(60);
    expect(leadDaysOf('taxiPermit', LEAD)).toBe(60);
    expect(leadDaysOf('medical', LEAD)).toBe(60);
    expect(leadDaysOf('taxiLicenseFee', LEAD)).toBe(60);
    expect(leadDaysOf('taxiLicenseRenewal', LEAD)).toBe(60);
    expect(leadDaysOf('leaseEnd', LEAD)).toBe(30);
    expect(leadDaysOf('document', LEAD)).toBe(30);
    expect(leadDaysOf('fineReassign', LEAD)).toBe(14);
    expect(leadDaysOf('dealTransfer', LEAD)).toBe(2);
    expect(leadDaysOf('dealerRegistration', LEAD)).toBe(30);
    expect(leadDaysOf('taxiAge', LEAD)).toBe(90);
    expect(leadDaysOf('taxiSemiAnnual', LEAD)).toBe(90);
    expect(leadDaysOf('contactFollowUp', LEAD)).toBe(0);
    expect(leadDaysOf('manual', LEAD)).toBe(0);
  });

  it('follows custom lead days', () => {
    expect(leadDaysOf('insurance', { ...LEAD, insurance: 7 })).toBe(7);
    expect(leadDaysOf('taxiLicenseFee', { ...LEAD, taxiLicense: 45 })).toBe(45);
  });
});

describe('feedSeverity', () => {
  it('overdue once the date has passed', () => {
    expect(feedSeverity('2026-11-11', T, 30)).toBe('overdue');
    expect(feedSeverity('2025-01-01', T, 0)).toBe('overdue');
  });

  it('due from leadDays before the date up to the date itself (today included)', () => {
    expect(feedSeverity(T, T, 0)).toBe('due');
    expect(feedSeverity(T, T, 30)).toBe('due');
    expect(feedSeverity('2026-12-12', T, 30)).toBe('due'); // exactly 30 days ahead
    expect(feedSeverity('2026-11-26', T, 14)).toBe('due');
  });

  it('upcoming beyond the lead days', () => {
    expect(feedSeverity('2026-12-13', T, 30)).toBe('upcoming'); // 31 days ahead
    expect(feedSeverity('2026-11-13', T, 0)).toBe('upcoming');
    expect(feedSeverity('2026-11-15', T, 2)).toBe('upcoming');
  });

  it('feedHorizon: `days` ahead, never less than the lead days', () => {
    expect(feedHorizon(T, 30, 60)).toBe('2027-01-11');
    expect(feedHorizon(T, 90, 30)).toBe('2027-02-10');
    expect(feedHorizon(T, 30, 0)).toBe('2026-12-12');
  });
});

describe('computed due dates', () => {
  it('dealer registration: 11 months after dealerRegisteredAt (month end clamped)', () => {
    expect(dealerRegistrationDueAt('2026-01-15')).toBe('2026-12-15');
    expect(dealerRegistrationDueAt('2025-12-12')).toBe('2026-11-12');
    expect(dealerRegistrationDueAt('2025-03-31')).toBe('2026-02-28');
    expect(dealerRegistrationDueAt('2023-03-31')).toBe('2024-02-29');
  });

  it('taxi age: semi-annual tests from 1 Jan of year + 10, blocked from 1 Jan of year + 12', () => {
    expect(taxiAgeDates(2016)).toEqual({ semiAnnualFrom: '2026-01-01', blockedFrom: '2028-01-01' });
    expect(taxiAgeDates(2023)).toEqual({ semiAnnualFrom: '2033-01-01', blockedFrom: '2035-01-01' });
  });
});

describe('toFeedItem', () => {
  it('classifies a candidate with id, daysLeft and severity', () => {
    expect(toFeedItem(candidate({ dueAt: '2026-11-20' }), options())).toEqual({
      id: 'vehicleRegistration:v1',
      kind: 'vehicleRegistration',
      entityType: 'vehicle',
      entityId: 'v1',
      title: '312-45-625 · Toyota Corolla',
      subtitle: null,
      dueAt: '2026-11-20',
      daysLeft: 8,
      severity: 'due',
      link: '/vehicles/v1',
    });
  });

  it('drops items beyond the horizon, keeps lead-day items even when `days` is shorter', () => {
    expect(toFeedItem(candidate({ dueAt: '2026-12-20' }), options({ days: 30 }))).toBeNull();
    const permit = candidate({ kind: 'taxiPermit', entityType: 'driver', dueAt: '2027-01-05' });
    expect(toFeedItem(permit, options({ days: 7 }))?.severity).toBe('due');
    expect(toFeedItem(candidate({ dueAt: '2020-01-01' }), options())?.severity).toBe('overdue');
  });

  it('feedItemId is <kind>:<entityId>', () => {
    expect(feedItemId('manual', 'r1')).toBe('manual:r1');
  });
});

describe('assembleFeed', () => {
  const list: FeedCandidate[] = [
    candidate({ entityId: 'a', dueAt: '2026-11-30' }), // due
    candidate({ entityId: 'b', dueAt: '2026-11-01' }), // overdue
    candidate({ kind: 'manual', entityType: 'reminder', entityId: 'c', dueAt: '2026-11-20' }), // upcoming
    candidate({ kind: 'insurance', entityType: 'insurance', entityId: 'd', dueAt: '2026-11-30' }), // due
    candidate({ entityId: 'e', dueAt: '2027-03-01' }), // outside the window
    candidate({ entityId: 'a', dueAt: '2026-11-25' }), // duplicate id: ignored
  ];

  it('counts per severity, sorts by dueAt then kind order, drops duplicates and far items', () => {
    const feed = assembleFeed(list, options());
    expect(feed.counts).toEqual({ overdue: 1, due: 2, upcoming: 1 });
    expect(feed.total).toBe(4);
    expect(feed.items.map((i) => i.id)).toEqual([
      'vehicleRegistration:b',
      'manual:c',
      'vehicleRegistration:a',
      'insurance:d',
    ]);
  });

  it('kind order breaks ties on the same date', () => {
    const order = FeedKind.options;
    expect(order.indexOf('vehicleRegistration')).toBeLessThan(order.indexOf('insurance'));
    const a = toFeedItem(list[0] as FeedCandidate, options());
    const d = toFeedItem(list[3] as FeedCandidate, options());
    expect(a && d && compareFeedItems(a, d)).toBeLessThan(0);
  });

  it('severity filter applies after the counts; kinds filter before', () => {
    const due = assembleFeed(list, options({ severity: ['due'] }));
    expect(due.counts).toEqual({ overdue: 1, due: 2, upcoming: 1 });
    expect(due.total).toBe(2);
    const manual = assembleFeed(list, options({ kinds: ['manual'] }));
    expect(manual.counts).toEqual({ overdue: 0, due: 0, upcoming: 1 });
    expect(manual.items.map((i) => i.id)).toEqual(['manual:c']);
  });

  it('paginates', () => {
    const page2 = assembleFeed(list, options({ page: 2, pageSize: 3 }));
    expect(page2.items.map((i) => i.id)).toEqual(['insurance:d']);
    expect(page2).toMatchObject({ total: 4, page: 2, pageSize: 3 });
  });
});

describe('reminderEntityLink', () => {
  it('links each entity type to its SPA page', () => {
    expect(reminderEntityLink('VEHICLE', 'v 1')).toBe('/vehicles/v%201');
    expect(reminderEntityLink('TAXI_LICENSE', 'l1')).toBe('/taxi-licenses/l1');
    expect(reminderEntityLink('DRIVER', 'd1')).toBe('/drivers/d1');
    expect(reminderEntityLink('CONTACT', 'c1')).toBe('/contacts/c1');
    expect(reminderEntityLink('LEASE', 'k1')).toBe('/leases/k1');
    expect(reminderEntityLink('DEAL', 'x1')).toBe('/deals/x1');
    expect(reminderEntityLink('FINE', 'f1')).toBe('/fines');
    expect(reminderEntityLink('INSURANCE', 'i1')).toBe('/vehicles?tab=insurance');
    expect(reminderEntityLink('DOCUMENT', 'doc')).toBe('/reminders');
  });

  it('falls back to /reminders without a complete link', () => {
    expect(reminderEntityLink(null, null)).toBe('/reminders');
    expect(reminderEntityLink('VEHICLE', null)).toBe('/reminders');
    expect(reminderEntityLink(undefined, 'v1')).toBe('/reminders');
  });
});
