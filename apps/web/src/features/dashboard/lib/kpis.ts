import type { DashboardCharts } from '@renawi/shared';

export interface MonthChange {
  direction: 'up' | 'down' | 'flat';
  /** Absolute change (ILS), always >= 0. */
  delta: number;
}

/**
 * Change of the profit from the previous month to the current one, from the charts' monthly
 * series (oldest first, current month last). Null when there are not two months to compare.
 */
export function profitChange(
  profitByMonth: DashboardCharts['profitByMonth'] | undefined,
): MonthChange | null {
  if (!profitByMonth || profitByMonth.length < 2) return null;
  const current = profitByMonth[profitByMonth.length - 1];
  const previous = profitByMonth[profitByMonth.length - 2];
  if (!current || !previous) return null;
  const diff = Math.round((current.profit - previous.profit) * 100) / 100;
  if (Math.abs(diff) < 0.5) return { direction: 'flat', delta: 0 };
  return { direction: diff > 0 ? 'up' : 'down', delta: Math.abs(diff) };
}
