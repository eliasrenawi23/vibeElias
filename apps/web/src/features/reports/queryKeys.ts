import type { ReportName } from '@renawi/shared';

/** TanStack Query keys for reports (one JSON result per report and parameter set). */
export const reportKeys = {
  all: ['reports'] as const,
  result: (name: ReportName, query: Readonly<Record<string, string>>) =>
    [...reportKeys.all, name, query] as const,
};
