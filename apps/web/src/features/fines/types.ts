import type { FineStatus, SortOrder } from '@renawi/shared';
import type { PlateRef } from '../taxi-licenses/types';
import type { NamedRef } from '../vehicles/types';

/** `GET /api/fines` item (and the body of every fine action response). */
export interface TrafficFine {
  id: string;
  vehicleId: string;
  driverId: string | null;
  contractId: string | null;
  fineNo: string | null;
  authority: string | null;
  /** Instant of the offence (ISO date-time). */
  offenceAt: string;
  receivedAt: string;
  amount: number;
  status: FineStatus;
  /** Last day to reassign the fine to the driver (received + 90 days). */
  reassignDeadline: string | null;
  /** Ledger CHARGE when the fine was rebilled to the driver. */
  chargeEntryId: string | null;
  notes: string | null;
  vehicle: PlateRef;
  /** Driver matched from the lease segment holding the car at the offence (or set by hand). */
  driver: NamedRef | null;
  /** `reassignDueSoon`, `reassignOverdue`. */
  alerts: string[];
}

export interface FineListQuery {
  /** Comma-separated statuses. */
  status?: string;
  vehicleId?: string;
  driverId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}
