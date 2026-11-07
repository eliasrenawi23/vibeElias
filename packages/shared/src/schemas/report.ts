import { z } from 'zod';
import { FineStatus, Locale } from '../enums.js';
import { isoDate, queryList } from '../primitives.js';

/*
 * Reports (`GET /reports/*`, milestone 5). Every report accepts `format=json|csv|xlsx` and an
 * optional `lang` for the CSV / XLSX header row and enum labels (default: the user's locale).
 * JSON returns `ReportResult` so the web can render any report generically: column `label`s
 * are i18n keys (`reports.columns.<key>`), enum cells carry raw values (`enums.<Name>.<VALUE>`).
 * Missing `from` defaults to 1 January of the current year, `to` / `asOf` to today.
 */

export const ReportFormat = z.enum(['json', 'csv', 'xlsx']);
export type ReportFormat = z.infer<typeof ReportFormat>;

/** Period grouping of the profit report. */
export const ReportPeriodGroupBy = z.enum(['month', 'quarter', 'year']);
export type ReportPeriodGroupBy = z.infer<typeof ReportPeriodGroupBy>;

export const ExpenseReportGroupBy = z.enum(['category', 'vehicle', 'month']);
export type ExpenseReportGroupBy = z.infer<typeof ExpenseReportGroupBy>;

export const LeaseIncomeGroupBy = z.enum(['month', 'license', 'driver']);
export type LeaseIncomeGroupBy = z.infer<typeof LeaseIncomeGroupBy>;

const output = z.object({
  format: ReportFormat.default('json'),
  lang: Locale.optional(),
});

const range = output.extend({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

const asOf = output.extend({
  asOf: isoDate.optional(),
});

/** `GET /reports/profit`: closed cycles by `endedAt` period + lease income by entry date. */
export const ProfitReportQuerySchema = range.extend({
  groupBy: ReportPeriodGroupBy.default('month'),
});
export type ProfitReportQuery = z.infer<typeof ProfitReportQuerySchema>;

/** `GET /reports/inventory-ageing`: stock (in stock / reserved / consigned) on `asOf`. */
export const InventoryAgeingQuerySchema = asOf;
export type InventoryAgeingQuery = z.infer<typeof InventoryAgeingQuerySchema>;

/** `GET /reports/receivables`: driver balances, deposits and ageing buckets on `asOf`. */
export const ReceivablesReportQuerySchema = asOf;
export type ReceivablesReportQuery = z.infer<typeof ReceivablesReportQuerySchema>;

/** `GET /reports/expenses`: vehicle expenses by date. */
export const ExpensesReportQuerySchema = range.extend({
  groupBy: ExpenseReportGroupBy.default('category'),
});
export type ExpensesReportQuery = z.infer<typeof ExpensesReportQuerySchema>;

/** `GET /reports/lease-income`: driver charges, credits and payments by date. */
export const LeaseIncomeReportQuerySchema = range.extend({
  groupBy: LeaseIncomeGroupBy.default('month'),
});
export type LeaseIncomeReportQuery = z.infer<typeof LeaseIncomeReportQuerySchema>;

/** `GET /reports/trade-book` (trade book, sefer sachar): cycles bought or sold in the period. */
export const TradeBookQuerySchema = range;
export type TradeBookQuery = z.infer<typeof TradeBookQuerySchema>;

/** `GET /reports/fines`: fines register by `receivedAt`. */
export const FinesReportQuerySchema = range.extend({
  status: queryList(FineStatus).optional(),
});
export type FinesReportQuery = z.infer<typeof FinesReportQuerySchema>;

/** Cell type of a report column (drives CSV / XLSX formatting and web rendering). */
export const ReportColumnType = z.enum(['text', 'money', 'int', 'date', 'bool', 'enum']);
export type ReportColumnType = z.infer<typeof ReportColumnType>;

export const ReportColumnSchema = z.object({
  key: z.string(),
  /** i18n key, `reports.columns.<key>`. */
  label: z.string(),
  type: ReportColumnType,
  /** `enum` columns: name of the labelled enum (`enums.<enum>.<VALUE>`). */
  enum: z.string().optional(),
});
export type ReportColumn = z.infer<typeof ReportColumnSchema>;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type ReportCell = z.infer<typeof cell>;
export type ReportRow = Record<string, ReportCell>;

/** JSON body of every report. */
export const ReportResultSchema = z.object({
  /** Report code, e.g. `profit`, `trade-book`. */
  report: z.string(),
  /** Effective parameters (defaults applied), e.g. `{ from, to, groupBy }` or `{ asOf }`. */
  params: z.record(z.union([z.string(), z.array(z.string())])),
  columns: z.array(ReportColumnSchema),
  rows: z.array(z.record(cell)),
  /** Sums of the money / count columns (null for the other keys); absent when meaningless. */
  totals: z.record(cell).optional(),
  /** Extra aggregates, e.g. the inventory `buckets` counts. */
  summary: z.record(z.unknown()).optional(),
});
export type ReportResult = z.infer<typeof ReportResultSchema>;

/** Days-in-stock buckets of the inventory ageing report. */
export const INVENTORY_AGE_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;
export type InventoryAgeBucket = (typeof INVENTORY_AGE_BUCKETS)[number];

/** Bucket of a days-in-stock count (negative counts as 0). */
export function inventoryAgeBucket(days: number): InventoryAgeBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}
