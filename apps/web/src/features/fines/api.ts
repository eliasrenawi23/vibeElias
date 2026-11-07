import type { FineStatus, Paginated } from '@renawi/shared';
import { http } from '../../shared/lib/http';
import type { FineListQuery, TrafficFine } from './types';

const finePath = (id: string) => `/fines/${encodeURIComponent(id)}`;

/** `GET /api/fines?status&vehicleId&driverId&page&pageSize` */
export function fetchFines(
  query: FineListQuery,
  signal?: AbortSignal,
): Promise<Paginated<TrafficFine>> {
  return http.get<Paginated<TrafficFine>>('/fines', { query: { ...query }, signal });
}

export interface FineCreateBody {
  vehicleId: string;
  offenceAt: string;
  receivedAt: string;
  amount: number;
  fineNo?: string | null;
  authority?: string | null;
  notes?: string | null;
}

/** `POST /api/fines` (the driver is matched from the lease segment at `offenceAt`). */
export function createFine(body: FineCreateBody): Promise<TrafficFine> {
  return http.post<TrafficFine>('/fines', body);
}

export interface FineUpdateBody {
  status?: FineStatus;
  driverId?: string | null;
  notes?: string | null;
}

/** `PATCH /api/fines/:id` */
export function updateFine(id: string, body: FineUpdateBody): Promise<TrafficFine> {
  return http.patch<TrafficFine>(finePath(id), body);
}

/** `POST /api/fines/:id/rebill` (409 `errors.fineNoDriver`, `errors.alreadyRebilled`). */
export function rebillFine(
  id: string,
  body: { date?: string; description?: string | null },
): Promise<TrafficFine> {
  return http.post<TrafficFine>(`${finePath(id)}/rebill`, body);
}
