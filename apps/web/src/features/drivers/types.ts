import type {
  DriverStatus,
  LeaseStatus,
  LeaseType,
  Locale,
  SortOrder,
  VehicleStatus,
} from '@renawi/shared';
import type { Ageing } from '../ledger/types';

/** Driver columns as returned by the API. */
export interface Driver {
  id: string;
  contactId: string;
  licenseNo: string | null;
  licenseExpiry: string | null;
  taxiPermitNo: string | null;
  taxiPermitExpiry: string | null;
  medicalExpiry: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  startedAt: string | null;
  status: DriverStatus;
  notes: string | null;
}

/** The driver's contact as embedded in driver responses. */
export interface DriverContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  phones: string[];
  idNumber: string | null;
  email: string | null;
  preferredLang: Locale;
}

/** Totals of a driver's ledger. `balance > 0`: the driver owes us. */
export interface DriverBalanceSummary {
  charged: number;
  paid: number;
  credited: number;
  balance: number;
  depositHeld: number;
}

/** `GET /api/drivers` item. */
export interface DriverListItem extends Driver {
  contact: DriverContact;
  /** Display name (from the contact). */
  name: string;
  activeContract: {
    id: string;
    contractNo: number;
    type: LeaseType;
    licenseNo: string;
    plateNo: string | null;
    monthlyRent: number;
  } | null;
  balance: DriverBalanceSummary;
  /** `licenseExpiring|licenseExpired`, `taxiPermitExpiring|taxiPermitExpired`, `medicalExpiring|medicalExpired`, `overdue`. */
  alerts: string[];
}

/** A contract row of the driver page. */
export interface DriverContractRow {
  id: string;
  contractNo: number;
  type: LeaseType;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  licenseNo: string | null;
  plateNo: string | null;
  monthlyRent: number | null;
}

/** A car owned by the driver (THIRD_PARTY, number-only leases). */
export interface OwnedVehicle {
  id: string;
  plateNo: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  status?: VehicleStatus;
  registrationExpiry?: string | null;
}

/** `GET /api/drivers/:id` */
export interface DriverDetail extends DriverListItem {
  contracts: DriverContractRow[];
  ageing: Ageing;
  ownedVehicles: OwnedVehicle[];
  documentCount: number;
}

/** Query of `GET /api/drivers`. */
export interface DriverListQuery {
  q?: string;
  /** Comma-separated statuses. */
  status?: string;
  withBalanceOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}
