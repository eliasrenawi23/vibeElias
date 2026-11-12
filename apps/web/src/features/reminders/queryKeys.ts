import type { FeedQuery, ReminderListQuery } from './api';

/**
 * TanStack Query keys for reminders. The feed (bell, dashboard, reminders page) and the manual
 * reminders both hang under `all`: invalidate it after any reminder change.
 */
export const reminderKeys = {
  all: ['reminders'] as const,
  feeds: () => [...reminderKeys.all, 'feed'] as const,
  feed: (query: FeedQuery) => [...reminderKeys.feeds(), query] as const,
  lists: () => [...reminderKeys.all, 'list'] as const,
  list: (query: ReminderListQuery) => [...reminderKeys.lists(), query] as const,
};
