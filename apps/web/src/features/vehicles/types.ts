import type {
  CommissionMode,
  CycleEndReason,
  CycleKind,
  ExpenseCategory,
  Fuel,
  Gearbox,
  InsuranceScope,
  InsuranceType,
  PaidBy,
  SortOrder,
  VehicleOwnership,
  VehicleStatus,
} from '@renawi/shared';

/** `{ id, name }` reference to a contact-like record. */
export interface NamedRef {
  id: string;
  name: string;
}

/** Vehicle columns as returned by the API (dates `YYYY-MM-DD`, money as numbers). */
export interface Vehicle {
  id: string;
  plateNo: string;
  vin: string | null;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  color: string | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  engineCc: number | null;
  hand: number | null;
  isTaxi: boolean;
  status: VehicleStatus;
  ownership: VehicleOwnership;
  ownerDriverId: string | null;
  currentKm: number | null;
  registrationExpiry: string | null;
  dealerRegisteredAt: string | null;
  meterSerial: string | null;
  meterSealedAt: string | null;
  location: string | null;
  listingPrice: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /api/vehicles` item. */
export interface VehicleListItem extends Vehicle {
  registeredLicense: { id: string; licenseNo: string } | null;
  ownerDriver: NamedRef | null;
  openCycle: { id: string; kind: CycleKind; startedAt: string } | null;
  /** Computed alert codes (`VehicleAlert` values; unknown codes are shown generically). */
  alerts: string[];
}

export interface InventoryCycle {
  id: string;
  kind: CycleKind;
  startedAt: string;
  endedAt: string | null;
  endReason: CycleEndReason | null;
  consignorId: string | null;
  consignor?: NamedRef | null;
  askingPrice: number | null;
  minNetToConsignor: number | null;
  commissionMode: CommissionMode | null;
  commissionValue: number | null;
  agreementEndsAt: string | null;
  /** All expenses of the cycle (whoever paid). */
  expenseTotal: number | null;
  /** Expenses of the cycle paid by the business. */
  expensePaidByUs?: number | null;
}

export interface InsurancePolicy {
  id: string;
  scope: InsuranceScope;
  vehicleId: string | null;
  type: InsuranceType;
  insurer: string;
  policyNo: string | null;
  startDate: string;
  endDate: string;
  premium: number | null;
  paidBy: PaidBy;
  hasTaxiExtension: boolean;
  /** Vehicle ref on business-level lists (`GET /insurance`). */
  vehicle?: { id: string; plateNo: string; make?: string; model?: string } | null;
}

export interface OdometerEntry {
  id: string;
  km: number;
  date: string;
  source: string | null;
}

export interface VehicleExpense {
  id: string;
  vehicleId: string;
  cycleId: string | null;
  category: ExpenseCategory;
  date: string;
  amount: number;
  vatIncluded: boolean;
  vatReclaimable: boolean;
  paidBy: PaidBy;
  vendorId: string | null;
  vendor?: NamedRef | null;
  description: string | null;
  rebilledEntryId?: string | null;
}

export interface ExpenseSummary {
  /** Sum of the amounts (whoever paid). */
  total: number;
  /** Sum of the amounts paid by the business. */
  paidByUs?: number;
  count?: number;
  /** Cycle the totals cover (`expenseSummary` of the vehicle: the open cycle). */
  cycleId?: string | null;
  byCategory: { category: ExpenseCategory; total: number }[];
}

/** `GET /api/vehicles/:id` */
export interface VehicleDetail extends VehicleListItem {
  cycles: InventoryCycle[];
  insurance: InsurancePolicy[];
  odometer: OdometerEntry[];
  expenseSummary: ExpenseSummary;
  documentCount: number;
}

/** Query of `GET /api/vehicles`. */
export interface VehicleListQuery {
  q?: string;
  /** Comma-separated statuses. */
  status?: string;
  ownership?: string;
  isTaxi?: boolean;
  make?: string;
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}

/** Query of `GET /api/vehicles/:id/expenses`. */
export interface ExpenseListQuery {
  from?: string;
  to?: string;
  /** Comma-separated categories. */
  category?: string;
  paidBy?: PaidBy;
  cycleId?: string;
}
