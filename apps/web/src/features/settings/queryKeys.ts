export const settingsKeys = {
  all: ['settings'] as const,
  detail: () => [...settingsKeys.all, 'detail'] as const,
  backup: () => [...settingsKeys.all, 'backup'] as const,
};
