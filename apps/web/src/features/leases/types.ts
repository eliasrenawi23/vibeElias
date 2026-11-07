import type {
  BillingPeriod,
  ChargeKind,
  DepositKind,
  HandoverChecklist,
  LeaseEndReason,
  LeaseStatus,
  LeaseType,
  Responsibilities,
  ReturnChecklist,
  SortOrder,
} from '@renawi/shared';
import type { DriverBalanceSummary } from '../drivers/types';
import type { PlateRef } from '../taxi-licenses/types';
import type { NamedRef } from '../vehicles/types';

/** Contract columns as returned by the API. */
export interface LeaseContract {
  id: string;
  contractNo: number;
  driverId: string;
  type: LeaseType;
  status: LeaseStatus;
  billingPeriod: BillingPeriod;
  startDate: string;
  endDate: string;
  actualEndDate: string | null;
  endReason: LeaseEndReason | null;
  paymentDay: number;
  rentIncludesVat: boolean;
  earlyExitPenaltyMonths: number;
  depositAmount: number;
  depositKind: DepositKind;
  responsibilities: Responsibilities;
  terms: string | null;
  notes: string | null;
  renewedFromId: string | null;
  signedAt: string | null;
}

/** The open segment of a contract: licence, car and rent from `startDate`. */
export interface LeaseCurrentSegment {
  id: string;
  taxiLicense: { id: string; licenseNo: string };
  vehicle: PlateRef | null;
  monthlyRent: number;
  startDate: string;
}

/** A segment of the contract history (newest first). */
export interface LeaseSegment extends LeaseCurrentSegment {
  endDate: string | null;
  reason: string | null;
}

/** `GET /api/leases` item. */
export interface LeaseListItem extends LeaseContract {
  driver: NamedRef;
  currentSegment: LeaseCurrentSegment | null;
  balance: Pick<DriverBalanceSummary, 'balance' | 'depositHeld'>;
  /** `endingSoon`, `ended`, `overdue`, `draft`. */
  alerts: string[];
}

export interface OpenCharge {
  id: string;
  chargeKind: ChargeKind;
  rentPeriod: string | null;
  dueDate: string | null;
  amount: number;
  remaining: number;
}

/** `GET /api/leases/:id` */
export interface LeaseDetail extends LeaseContract {
  driver: NamedRef;
  segments: LeaseSegment[];
  currentSegment: LeaseCurrentSegment | null;
  balance: DriverBalanceSummary;
  openCharges: OpenCharge[];
  lastPayment: { date: string; amount: number } | null;
  handoverChecklist: HandoverChecklist | null;
  returnChecklist: ReturnChecklist | null;
  documentCount: number;
  alerts: string[];
}

export interface LeaseListQuery {
  /** Comma-separated statuses. */
  status?: string;
  driverId?: string;
  taxiLicenseId?: string;
  vehicleId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}
