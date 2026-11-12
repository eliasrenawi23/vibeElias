/** TanStack Query keys of the dashboard (its expiring widget uses the reminders feed keys). */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: () => [...dashboardKeys.all, 'kpis'] as const,
  activity: (limit: number) => [...dashboardKeys.all, 'activity', limit] as const,
  charts: (months: number) => [...dashboardKeys.all, 'charts', months] as const,
};
