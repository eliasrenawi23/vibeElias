export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: () => [...dashboardKeys.all, 'kpis'] as const,
  expiring: (days: number) => [...dashboardKeys.all, 'expiring', days] as const,
};
