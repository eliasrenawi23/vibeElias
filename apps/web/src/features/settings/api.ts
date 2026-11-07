import type { SettingsResponse, SettingsUpdate } from '@renawi/shared';
import { http } from '../../shared/lib/http';

/** `GET /api/settings`: the business settings singleton. */
export function fetchSettings(signal?: AbortSignal): Promise<SettingsResponse> {
  return http.get<SettingsResponse>('/settings', { signal });
}

/** `PATCH /api/settings` with any subset of top-level fields; returns the updated settings. */
export function updateSettings(body: SettingsUpdate): Promise<SettingsResponse> {
  return http.patch<SettingsResponse>('/settings', body);
}
