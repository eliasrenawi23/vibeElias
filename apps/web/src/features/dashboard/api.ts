/**
 * Dashboard data. `GET /dashboard/kpis` and `GET /reminders/feed` arrive in milestone 5; until
 * then "profit this month" is a zero sample. Live already: vehicles in stock
 * (`GET /vehicles?status=IN_STOCK&pageSize=1`), active leases (`GET /leases?status=ACTIVE&pageSize=1`)
 * and driver receivables (sum of the positive balances of `GET /ledger/balances`).
 */

export interface DashboardKpis {
  vehiclesInStock: number;
  activeLeases: number;
  /** Sum of positive driver balances (ILS). */
  receivables: number;
  /** Realised profit of the current month (ILS). */
  monthProfit: number;
}

export interface ExpiringItem {
  id: string;
  label: string;
  dueDate: string;
}

/** Days ahead shown in the "expiring soon" list. */
export const EXPIRING_WINDOW_DAYS = 30;

/** Milestone that replaces the sample figures with live data. */
export const LIVE_DASHBOARD_MILESTONE = 5;

export const SAMPLE_KPIS: Readonly<DashboardKpis> = Object.freeze({
  vehiclesInStock: 0,
  activeLeases: 0,
  receivables: 0,
  monthProfit: 0,
});

export async function fetchKpis(): Promise<DashboardKpis> {
  return { ...SAMPLE_KPIS };
}

export async function fetchExpiring(_days: number): Promise<ExpiringItem[]> {
  return [];
}
