import { http } from '../../shared/lib/http';

/**
 * Dashboard data. The KPIs come from `GET /dashboard/kpis` (live since milestone 4); the expiry
 * feed (`GET /reminders/feed`) arrives in milestone 5.
 */

/** `GET /api/dashboard/kpis` */
export interface DashboardKpis {
  vehiclesInStock: number;
  activeLeases: number;
  /** Sum of positive driver balances (ILS). */
  receivables: number;
  /** Realised profit of the current month (ILS; negative = loss). */
  monthProfit: number;
  /** Draft and pending deals. */
  openDeals: number;
  /** Completed sales past their 6-working-day transfer deadline. */
  transfersOverdue: number;
}

export interface ExpiringItem {
  id: string;
  label: string;
  dueDate: string;
}

/** Days ahead shown in the "expiring soon" list. */
export const EXPIRING_WINDOW_DAYS = 30;

export function fetchKpis(signal?: AbortSignal): Promise<DashboardKpis> {
  return http.get<DashboardKpis>('/dashboard/kpis', { signal });
}

export async function fetchExpiring(_days: number): Promise<ExpiringItem[]> {
  return [];
}
