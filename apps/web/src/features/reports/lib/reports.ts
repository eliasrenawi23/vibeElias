import {
  ExpenseReportGroupBy,
  LeaseIncomeGroupBy,
  REPORT_TITLE_KEYS,
  type ReportName,
  ReportPeriodGroupBy,
  toLocale,
  type ReportFormat,
} from '@renawi/shared';
import type { TKey } from '../../../shared/lib/i18n';
import { API_BASE } from '../../../shared/lib/http';

/** What a report's parameter bar offers. */
export interface ReportDef {
  name: ReportName;
  /** `reports.names.<camelCase>` (also the XLSX sheet name). */
  titleKey: TKey;
  descriptionKey: TKey;
  /** `range` = from / to with period presets; `asOf` = one date. */
  period: 'range' | 'asOf';
  /** Group-by options, the first one the API default. */
  groupBy?: readonly string[];
  /** Status multi-select (fines). */
  status?: boolean;
}

const camel = (name: ReportName) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function def(
  name: ReportName,
  rest: Omit<ReportDef, 'name' | 'titleKey' | 'descriptionKey'>,
): ReportDef {
  return {
    name,
    titleKey: REPORT_TITLE_KEYS[name] as TKey,
    descriptionKey: `reports.descriptions.${camel(name)}` as TKey,
    ...rest,
  };
}

/** Every report, in the order of the reports index. */
export const REPORTS: readonly ReportDef[] = [
  def('profit', { period: 'range', groupBy: ReportPeriodGroupBy.options }),
  def('inventory-ageing', { period: 'asOf' }),
  def('receivables', { period: 'asOf' }),
  def('expenses', { period: 'range', groupBy: ExpenseReportGroupBy.options }),
  def('lease-income', { period: 'range', groupBy: LeaseIncomeGroupBy.options }),
  def('trade-book', { period: 'range' }),
  def('fines', { period: 'range', status: true }),
];

/** The report of a `/reports/:name` URL segment, or null. */
export function reportDef(name: string | undefined): ReportDef | null {
  return REPORTS.find((r) => r.name === name) ?? null;
}

/** URL params a report reads (everything else in the page URL is ignored). */
export function reportParamKeys(report: ReportDef): string[] {
  return [
    ...(report.period === 'range' ? ['from', 'to'] : ['asOf']),
    ...(report.groupBy ? ['groupBy'] : []),
    ...(report.status ? ['status'] : []),
  ];
}

/**
 * The report's API parameters from the page URL: only its own keys, only non-empty values, in a
 * stable order (also the query key of the JSON request).
 */
export function reportQuery(report: ReportDef, search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of reportParamKeys(report)) {
    const value = search.get(key)?.trim();
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Download link of an export: the same parameters as the table, plus `format` and the UI
 * language (column headers, enum labels and the context sheet are translated by the API).
 */
export function reportExportHref(
  name: ReportName,
  query: Readonly<Record<string, string>>,
  format: Exclude<ReportFormat, 'json'>,
  language: string | undefined,
): string {
  const params = new URLSearchParams(query);
  params.set('format', format);
  params.set('lang', toLocale(language));
  return `${API_BASE}/reports/${name}?${params.toString()}`;
}
