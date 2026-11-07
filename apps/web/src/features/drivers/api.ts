import type { ContactCreate, DriverStatus, Paginated } from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { DriverDetail, DriverListItem, DriverListQuery } from './types';

const driverPath = (id: string) => `/drivers/${encodeURIComponent(id)}`;

/** `GET /api/drivers?q&status&withBalanceOnly&page&pageSize&sort&order` */
export function fetchDrivers(
  query: DriverListQuery,
  signal?: AbortSignal,
): Promise<Paginated<DriverListItem>> {
  return http.get<Paginated<DriverListItem>>('/drivers', {
    query: { ...query, withBalanceOnly: query.withBalanceOnly ? true : undefined },
    signal,
  });
}

export function fetchDriver(id: string, signal?: AbortSignal): Promise<DriverDetail> {
  return http.get<DriverDetail>(driverPath(id), { signal });
}

/** Driver columns sent on create / update. */
export interface DriverFieldsBody {
  licenseNo?: string | null;
  licenseExpiry?: string | null;
  taxiPermitNo?: string | null;
  taxiPermitExpiry?: string | null;
  medicalExpiry?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  startedAt?: string | null;
  status?: DriverStatus;
  notes?: string | null;
}

/** `POST /api/drivers`: an existing contact (`contactId`) or a new one (`contact`). */
export type DriverCreateBody = DriverFieldsBody &
  ({ contactId: string; contact?: never } | { contact: ContactCreate; contactId?: never });

/** `POST /api/drivers` (409 `errors.alreadyDriver`). */
export function createDriver(body: DriverCreateBody): Promise<DriverDetail> {
  return http.post<DriverDetail>('/drivers', body);
}

/** `PATCH /api/drivers/:id`; returns the full driver. */
export function updateDriver(id: string, body: DriverFieldsBody): Promise<DriverDetail> {
  return http.patch<DriverDetail>(driverPath(id), body);
}
