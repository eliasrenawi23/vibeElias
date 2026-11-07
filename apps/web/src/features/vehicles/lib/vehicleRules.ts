import {
  ExpenseCategory,
  MANUAL_VEHICLE_STATUS_TRANSITIONS,
  type VehicleStatus,
} from '@renawi/shared';
import type { ExpenseSummary, InventoryCycle, VehicleDetail, VehicleExpense } from '../types';

/** Statuses `POST /vehicles/:id/status` accepts from `status` (sales and leases have their own flows). */
export function allowedStatusTargets(status: VehicleStatus): readonly VehicleStatus[] {
  return MANUAL_VEHICLE_STATUS_TRANSITIONS[status] ?? [];
}

/** The vehicle's open inventory cycle (from `openCycle`, else the cycle list). */
export function openCycleOf(
  vehicle: Pick<VehicleDetail, 'openCycle' | 'cycles'>,
): InventoryCycle | null {
  const fromList = vehicle.cycles.find((c) => !c.endedAt) ?? null;
  if (fromList) return fromList;
  if (!vehicle.openCycle) return null;
  return vehicle.cycles.find((c) => c.id === vehicle.openCycle?.id) ?? null;
}

/** True when the vehicle has an open cycle (either source). */
export function hasOpenCycle(vehicle: Pick<VehicleDetail, 'openCycle' | 'cycles'>): boolean {
  return Boolean(vehicle.openCycle) || vehicle.cycles.some((c) => !c.endedAt);
}

/**
 * A car can be taken on consignment when no inventory cycle is open and it is not leased or
 * scrapped: our own car (OWNED), a car outside the inventory (EXTERNAL), or a consignment car
 * whose previous agreement ended.
 */
export function canConsign(
  vehicle: Pick<VehicleDetail, 'openCycle' | 'cycles' | 'ownership' | 'status'>,
): boolean {
  if (hasOpenCycle(vehicle)) return false;
  if (vehicle.status === 'LEASED' || vehicle.status === 'SCRAPPED') return false;
  return (
    vehicle.ownership === 'OWNED' ||
    vehicle.ownership === 'CONSIGNED' ||
    vehicle.status === 'EXTERNAL'
  );
}

/** The open CONSIGNED cycle that "return to consignor" would end, if any. */
export function returnableCycle(
  vehicle: Pick<VehicleDetail, 'openCycle' | 'cycles'>,
): InventoryCycle | null {
  const open = openCycleOf(vehicle);
  return open?.kind === 'CONSIGNED' ? open : null;
}

/** Totals of a list of expenses (all of them, and per category in `ExpenseCategory` order). */
export function summarizeExpenses(items: readonly VehicleExpense[]): ExpenseSummary {
  const perCategory = new Map<string, number>();
  let total = 0;
  for (const e of items) {
    const amount = Number(e.amount) || 0;
    total += amount;
    perCategory.set(e.category, (perCategory.get(e.category) ?? 0) + amount);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    total: round(total),
    byCategory: ExpenseCategory.options
      .filter((c) => perCategory.has(c))
      .map((category) => ({ category, total: round(perCategory.get(category) ?? 0) })),
  };
}
