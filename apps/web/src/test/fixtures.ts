import type { FeedItem } from '@renawi/shared';

/** A reminders-feed item for tests (a vehicle licence due in 8 days unless overridden). */
export function feedItem(over: Partial<FeedItem>): FeedItem {
  return {
    id: 'vehicle:registration:veh_1',
    kind: 'vehicleRegistration',
    entityType: 'vehicle',
    entityId: 'veh_1',
    title: '12-345-67 Toyota Corolla',
    subtitle: null,
    dueAt: '2026-11-20',
    daysLeft: 8,
    severity: 'due',
    link: '/vehicles/veh_1',
    ...over,
  };
}
