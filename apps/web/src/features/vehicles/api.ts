import type {
  BusinessInsuranceCreate,
  Consign,
  CycleReturn,
  ExpenseCreate,
  ExpenseUpdate,
  InsuranceCreate,
  InsuranceUpdate,
  OdometerCreate,
  Paginated,
  VehicleCreate,
  VehicleStatusChange,
  VehicleUpdate,
} from '@renawi/shared';
import { asItems } from '../../shared/lib/collections';
import { http } from '../../shared/lib/http';
import { summarizeExpenses } from './lib/vehicleRules';
import type {
  ExpenseListQuery,
  ExpenseSummary,
  InsurancePolicy,
  OdometerEntry,
  VehicleDetail,
  VehicleExpense,
  VehicleListItem,
  VehicleListQuery,
} from './types';

const vehiclePath = (id: string) => `/vehicles/${encodeURIComponent(id)}`;

/* ---- Vehicles ------------------------------------------------------------------------------ */

/** `GET /api/vehicles?q&status&ownership&isTaxi&make&yearFrom&yearTo&page&pageSize&sort&order` */
export function fetchVehicles(
  query: VehicleListQuery,
  signal?: AbortSignal,
): Promise<Paginated<VehicleListItem>> {
  return http.get<Paginated<VehicleListItem>>('/vehicles', {
    query: { ...query, isTaxi: query.isTaxi ? true : undefined },
    signal,
  });
}

/** Number of vehicles with a status (`pageSize=1`, reads `total`). */
export async function countVehicles(status: string, signal?: AbortSignal): Promise<number> {
  const res = await http.get<Paginated<VehicleListItem>>('/vehicles', {
    query: { status, pageSize: 1 },
    signal,
  });
  return res.total;
}

export function fetchVehicle(id: string, signal?: AbortSignal): Promise<VehicleDetail> {
  return http.get<VehicleDetail>(vehiclePath(id), { signal });
}

/** `POST /api/vehicles` (409 `errors[plateNo|vin] = validation.duplicate`). */
export function createVehicle(body: VehicleCreate): Promise<VehicleDetail> {
  return http.post<VehicleDetail>('/vehicles', body);
}

export function updateVehicle(id: string, body: VehicleUpdate): Promise<VehicleDetail> {
  return http.patch<VehicleDetail>(vehiclePath(id), body);
}

/**
 * `POST /api/vehicles/:id/status` (409 `errors.invalidTransition` / `errors.useDeal` /
 * `errors.vehicleLeased`); returns the full vehicle file.
 */
export function changeVehicleStatus(id: string, body: VehicleStatusChange): Promise<VehicleDetail> {
  return http.post<VehicleDetail>(`${vehiclePath(id)}/status`, body);
}

/* ---- Expenses ------------------------------------------------------------------------------ */

export interface ExpenseList {
  items: VehicleExpense[];
  /** Totals over `items` (from the API when it sends them, else computed here). */
  summary: ExpenseSummary;
}

/**
 * `GET /api/vehicles/:id/expenses?from&to&category&paidBy&cycleId`: every matching expense
 * (unpaged) as `{ items, total, summary }` (`total` = sum of amounts). A bare array or a body
 * without `summary` is accepted too (totals are then computed here).
 */
export async function fetchExpenses(
  vehicleId: string,
  query: ExpenseListQuery,
  signal?: AbortSignal,
): Promise<ExpenseList> {
  const res = await http.get<
    VehicleExpense[] | { items?: VehicleExpense[]; summary?: ExpenseSummary }
  >(`${vehiclePath(vehicleId)}/expenses`, { query: { ...query }, signal });
  const items = asItems(res);
  const summary = !Array.isArray(res) && res.summary ? res.summary : summarizeExpenses(items);
  return { items, summary };
}

export function createExpense(vehicleId: string, body: ExpenseCreate): Promise<VehicleExpense> {
  return http.post<VehicleExpense>(`${vehiclePath(vehicleId)}/expenses`, body);
}

export function updateExpense(id: string, body: ExpenseUpdate): Promise<VehicleExpense> {
  return http.patch<VehicleExpense>(`/expenses/${encodeURIComponent(id)}`, body);
}

export function deleteExpense(id: string): Promise<void> {
  return http.delete<void>(`/expenses/${encodeURIComponent(id)}`);
}

/* ---- Insurance ----------------------------------------------------------------------------- */

export function createVehicleInsurance(
  vehicleId: string,
  body: InsuranceCreate,
): Promise<InsurancePolicy> {
  return http.post<InsurancePolicy>(`${vehiclePath(vehicleId)}/insurance`, body);
}

/** `GET /api/insurance?scope=BUSINESS&activeOnly` */
export async function fetchBusinessInsurance(
  activeOnly: boolean,
  signal?: AbortSignal,
): Promise<InsurancePolicy[]> {
  const res = await http.get<InsurancePolicy[] | { items: InsurancePolicy[] }>('/insurance', {
    query: { scope: 'BUSINESS', activeOnly: activeOnly || undefined },
    signal,
  });
  return asItems(res);
}

export function createBusinessInsurance(body: BusinessInsuranceCreate): Promise<InsurancePolicy> {
  return http.post<InsurancePolicy>('/insurance', body);
}

export function updateInsurance(id: string, body: InsuranceUpdate): Promise<InsurancePolicy> {
  return http.patch<InsurancePolicy>(`/insurance/${encodeURIComponent(id)}`, body);
}

export function deleteInsurance(id: string): Promise<void> {
  return http.delete<void>(`/insurance/${encodeURIComponent(id)}`);
}

/* ---- Odometer & cycles --------------------------------------------------------------------- */

/** `POST /api/vehicles/:id/odometer` (400 `validation.odometerDecreasing`). */
export function addOdometerReading(
  vehicleId: string,
  body: OdometerCreate,
): Promise<OdometerEntry> {
  return http.post<OdometerEntry>(`${vehiclePath(vehicleId)}/odometer`, body);
}

/** `POST /api/vehicles/:id/consign`: opens a CONSIGNED cycle; returns the full vehicle file. */
export function consignVehicle(vehicleId: string, body: Consign): Promise<VehicleDetail> {
  return http.post<VehicleDetail>(`${vehiclePath(vehicleId)}/consign`, body);
}

/**
 * `POST /api/cycles/:id/return`: consignment car back to its owner (409 `errors.dealPending`,
 * 400 `validation.endBeforeStart`); returns the full vehicle file.
 */
export function returnCycle(cycleId: string, body: CycleReturn): Promise<VehicleDetail> {
  return http.post<VehicleDetail>(`/cycles/${encodeURIComponent(cycleId)}/return`, body);
}
