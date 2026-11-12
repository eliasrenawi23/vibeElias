import type { ReportName, ReportResult } from '@renawi/shared';
import { http } from '../../shared/lib/http';

/**
 * `GET /api/reports/<name>?…&format=json`: the generic report body (`columns` with i18n label
 * keys and cell types, `rows`, optional `totals` and `summary`). CSV / XLSX are plain download
 * links (`reportExportHref`).
 */
export function fetchReport(
  name: ReportName,
  query: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<ReportResult> {
  return http.get<ReportResult>(`/reports/${name}`, {
    query: { ...query, format: 'json' },
    signal,
  });
}
