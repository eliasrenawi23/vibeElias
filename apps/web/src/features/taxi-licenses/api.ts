import type { Paginated, TaxiLicenseCreate, TaxiLicenseUpdate } from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { TaxiLicenseDetail, TaxiLicenseListItem, TaxiLicenseListQuery } from './types';

const licensePath = (id: string) => `/taxi-licenses/${encodeURIComponent(id)}`;

/** `GET /api/taxi-licenses?q&status&page&pageSize&sort&order` */
export function fetchTaxiLicenses(
  query: TaxiLicenseListQuery,
  signal?: AbortSignal,
): Promise<Paginated<TaxiLicenseListItem>> {
  return http.get<Paginated<TaxiLicenseListItem>>('/taxi-licenses', {
    query: { ...query },
    signal,
  });
}

export function fetchTaxiLicense(id: string, signal?: AbortSignal): Promise<TaxiLicenseDetail> {
  return http.get<TaxiLicenseDetail>(licensePath(id), { signal });
}

/** `POST /api/taxi-licenses` (409 `errors[licenseNo] = validation.duplicate`). */
export function createTaxiLicense(body: TaxiLicenseCreate): Promise<TaxiLicenseDetail> {
  return http.post<TaxiLicenseDetail>('/taxi-licenses', body);
}

export function updateTaxiLicense(id: string, body: TaxiLicenseUpdate): Promise<TaxiLicenseDetail> {
  return http.patch<TaxiLicenseDetail>(licensePath(id), body);
}

/**
 * `POST /api/taxi-licenses/:id/register-vehicle { vehicleId }` (`null` detaches; 409
 * `errors.taxiAgeBlocked`, `errors.vehicleAlreadyRegistered`); returns the full licence.
 */
export function registerVehicle(id: string, vehicleId: string | null): Promise<TaxiLicenseDetail> {
  return http.post<TaxiLicenseDetail>(`${licensePath(id)}/register-vehicle`, { vehicleId });
}
