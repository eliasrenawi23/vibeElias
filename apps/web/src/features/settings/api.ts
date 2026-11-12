import type { BackupStatus, SettingsResponse, SettingsUpdate } from '@renawi/shared';
import { http, isApiError } from '../../shared/lib/http';

/** `GET /api/settings`: the business settings singleton. */
export function fetchSettings(signal?: AbortSignal): Promise<SettingsResponse> {
  return http.get<SettingsResponse>('/settings', { signal });
}

/** `PATCH /api/settings` with any subset of top-level fields; returns the updated settings. */
export function updateSettings(body: SettingsUpdate): Promise<SettingsResponse> {
  return http.patch<SettingsResponse>('/settings', body);
}

/**
 * `GET /api/settings/backup-status`: the last successful nightly backup. `null` when the server
 * has no backup monitoring (404: endpoint or status file not set up).
 */
export async function fetchBackupStatus(signal?: AbortSignal): Promise<BackupStatus | null> {
  try {
    return await http.get<BackupStatus>('/settings/backup-status', { signal });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
