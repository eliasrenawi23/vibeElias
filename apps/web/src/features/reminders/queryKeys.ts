/** TanStack Query keys for reminders (the list/detail queries arrive in milestone 5). */
export const reminderKeys = {
  all: ['reminders'] as const,
  lists: () => [...reminderKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...reminderKeys.lists(), filters] as const,
  detail: (id: string) => [...reminderKeys.all, 'detail', id] as const,
};
