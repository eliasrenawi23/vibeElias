import type { SortOrder, TaxiLicenseStatus } from '@renawi/shared';
import type { NamedRef } from '../vehicles/types';

/** Licence columns as returned by the API. */
export interface TaxiLicense {
  id: string;
  licenseNo: string;
  holderName: string | null;
  status: TaxiLicenseStatus;
  acquiredAt: string | null;
  acquisitionPrice: number | null;
  soldAt: string | null;
  salePrice: number | null;
  annualFeeDueAt: string | null;
  renewalAt: string | null;
  notes: string | null;
}

export interface PlateRef {
  id: string;
  plateNo: string;
}

/** The open lease segment of a licence (who drives it now, at what rent). */
export interface LicenseCurrentSegment {
  id: string;
  contractId: string;
  contractNo: number;
  driver: NamedRef;
  vehicle: PlateRef | null;
  monthlyRent: number;
  startDate: string;
}

/** A past or current assignment of the licence. */
export interface LicenseSegment extends LicenseCurrentSegment {
  endDate: string | null;
  reason: string | null;
}

/** `GET /api/taxi-licenses` item. */
export interface TaxiLicenseListItem extends TaxiLicense {
  registeredVehicle: PlateRef | null;
  currentSegment: LicenseCurrentSegment | null;
  /** `annualFeeDue`, `annualFeeOverdue`, `renewalDue`, `renewalOverdue`, `idle`. */
  alerts: string[];
}

/** `GET /api/taxi-licenses/:id` */
export interface TaxiLicenseDetail extends TaxiLicenseListItem {
  segments: LicenseSegment[];
  documentCount: number;
}

export interface TaxiLicenseListQuery {
  q?: string;
  /** Comma-separated statuses. */
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}
