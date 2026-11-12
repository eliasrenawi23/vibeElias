import type { ActivityItem, DashboardCharts, DashboardKpis } from '@renawi/shared';
import { http } from '../../shared/lib/http';

/**
 * `GET /dashboard/kpis`. The milestone-5 fields (`expiring`, `finesOpen`, `receivablesOverdue`)
 * are optional here so an older server still renders: a missing value shows as "—" with a
 * reason, never as a fake 0.
 */
export type DashboardKpisResponse = Omit<
  DashboardKpis,
  'expiring' | 'finesOpen' | 'receivablesOverdue'
> &
  Partial<Pick<DashboardKpis, 'expiring' | 'finesOpen' | 'receivablesOverdue'>>;

/** Days ahead the dashboard's "expiring soon" widget looks (the feed's default window). */
export const EXPIRING_WINDOW_DAYS = 30;
/** Items shown in the "expiring soon" widget. */
export const EXPIRING_WIDGET_SIZE = 8;
/** Months of the dashboard charts. */
export const CHART_MONTHS = 12;
/** Rows of the recent activity list. */
export const ACTIVITY_LIMIT = 10;

/** `GET /api/dashboard/kpis` */
export function fetchKpis(signal?: AbortSignal): Promise<DashboardKpisResponse> {
  return http.get<DashboardKpisResponse>('/dashboard/kpis', { signal });
}

/** `GET /api/dashboard/activity?limit`: latest audited changes, newest first. */
export function fetchActivity(limit: number, signal?: AbortSignal): Promise<ActivityItem[]> {
  return http.get<ActivityItem[]>('/dashboard/activity', { query: { limit }, signal });
}

/** `GET /api/dashboard/charts?months`: profit by month, receivables ageing, inventory. */
export function fetchCharts(months: number, signal?: AbortSignal): Promise<DashboardCharts> {
  return http.get<DashboardCharts>('/dashboard/charts', { query: { months }, signal });
}
