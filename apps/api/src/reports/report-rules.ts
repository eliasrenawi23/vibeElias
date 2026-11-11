import {
  addPeriods,
  diffDays,
  monthsBetween,
  periodEnd,
  periodOf,
  periodStart,
  sumMoney,
  type DecimalValue,
  type LabelledEnumName,
  type ReportCell,
  type ReportColumn,
  type ReportColumnType,
  type ReportPeriodGroupBy,
  type ReportRow,
} from '@renawi/shared';

/* Pure helpers of the reports (no I/O). */

/** Column definition; the label is the i18n key `reports.columns.<key>`. */
export function col(key: string, type: ReportColumnType, enumName?: LabelledEnumName): ReportColumn {
  return enumName
    ? { key, label: `reports.columns.${key}`, type, enum: enumName }
    : { key, label: `reports.columns.${key}`, type };
}

/**
 * Effective date range: `from` defaults to 1 January of `today`'s year, `to` to `today`; a
 * reversed range is swapped.
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
): { from: string; to: string } {
  const f = from ?? `${today.slice(0, 4)}-01-01`;
  const t = to ?? today;
  return f <= t ? { from: f, to: t } : { from: t, to: f };
}

/** Period key of a date: `2026-11` (month), `2026-Q4` (quarter), `2026` (year). */
export function periodKey(iso: string, groupBy: ReportPeriodGroupBy): string {
  if (groupBy === 'year') return iso.slice(0, 4);
  if (groupBy === 'quarter') {
    const quarter = Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
    return `${iso.slice(0, 4)}-Q${quarter}`;
  }
  return iso.slice(0, 7);
}

/** Every period key touched by `[from, to]`, oldest first. */
export function periodKeys(from: string, to: string, groupBy: ReportPeriodGroupBy): string[] {
  const keys: string[] = [];
  for (const month of monthsBetween(from, to)) {
    const key = periodKey(`${month}-01`, groupBy);
    if (keys[keys.length - 1] !== key) keys.push(key);
  }
  return keys;
}

/**
 * Totals row: sums of the `money` / `int` columns (missing cells skipped; null when every
 * cell is missing), null for every other column.
 */
export function totalsOf(
  columns: readonly ReportColumn[],
  rows: readonly ReportRow[],
): Record<string, ReportCell> {
  const totals: Record<string, ReportCell> = {};
  for (const c of columns) {
    if (c.type !== 'money' && c.type !== 'int') {
      totals[c.key] = null;
      continue;
    }
    const values = rows
      .map((r) => r[c.key])
      .filter((v): v is number => typeof v === 'number');
    totals[c.key] = values.length === 0 ? null : sumMoney(values);
  }
  return totals;
}

/** Whole days from `from` to `to` (0 when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.max(0, diffDays(from, to));
}

/* ------------------------------------------------------------------------------------------ */
/* Profit by period                                                                           */
/* ------------------------------------------------------------------------------------------ */

/** Money columns of a profit period (`GET /reports/profit`, dashboard `profitByMonth`). */
export interface ProfitPeriod {
  period: string;
  /** Sale prices of OWNED cycles closed in the period. */
  salesRevenue: number;
  /** Purchase prices of those cycles. */
  purchaseCost: number;
  /** Expenses of the closed cycles paid by us (net of reclaimable VAT) minus rebills. */
  expenses: number;
  /** VAT of the closed cycles (margin / full sale VAT minus input VAT). */
  vatOnMargin: number;
  /** Commissions of CONSIGNED cycles closed in the period. */
  commission: number;
  /** Driver charges minus credits by entry date (expense rebills excluded). */
  leaseIncome: number;
  profit: number;
}

/** What the profit aggregation needs of a closed cycle (from the vehicle P&L rules). */
export interface ProfitCycle {
  endedAt: string;
  sale: number;
  commission: number;
  purchase: number;
  expenses: number;
  rebilled: number;
  vat: number;
}

export interface ProfitIncome {
  date: string;
  type: 'CHARGE' | 'CREDIT';
  amount: DecimalValue;
}

/** Profit rows for every period of `[from, to]` (empty periods are zeros). */
export function aggregateProfit(
  cycles: readonly ProfitCycle[],
  income: readonly ProfitIncome[],
  from: string,
  to: string,
  groupBy: ReportPeriodGroupBy,
): ProfitPeriod[] {
  const parts = new Map<string, Record<Exclude<keyof ProfitPeriod, 'period' | 'profit'>, DecimalValue[]>>();
  const bucket = (key: string) => {
    let b = parts.get(key);
    if (!b) {
      b = {
        salesRevenue: [],
        purchaseCost: [],
        expenses: [],
        vatOnMargin: [],
        commission: [],
        leaseIncome: [],
      };
      parts.set(key, b);
    }
    return b;
  };
  for (const c of cycles) {
    if (c.endedAt < from || c.endedAt > to) continue;
    const b = bucket(periodKey(c.endedAt, groupBy));
    b.salesRevenue.push(c.sale);
    b.commission.push(c.commission);
    b.purchaseCost.push(c.purchase);
    b.expenses.push(c.expenses, -c.rebilled);
    b.vatOnMargin.push(c.vat);
  }
  for (const e of income) {
    if (e.date < from || e.date > to) continue;
    const b = bucket(periodKey(e.date, groupBy));
    b.leaseIncome.push(e.type === 'CREDIT' ? -Number(e.amount) : e.amount);
  }
  return periodKeys(from, to, groupBy).map((period) => {
    const b = parts.get(period);
    const salesRevenue = sumMoney(b?.salesRevenue ?? []);
    const purchaseCost = sumMoney(b?.purchaseCost ?? []);
    const expenses = sumMoney(b?.expenses ?? []);
    const vatOnMargin = sumMoney(b?.vatOnMargin ?? []);
    const commission = sumMoney(b?.commission ?? []);
    const leaseIncome = sumMoney(b?.leaseIncome ?? []);
    return {
      period,
      salesRevenue,
      purchaseCost,
      expenses,
      vatOnMargin,
      commission,
      leaseIncome,
      profit: sumMoney([
        salesRevenue,
        commission,
        leaseIncome,
        -purchaseCost,
        -expenses,
        -vatOnMargin,
      ]),
    };
  });
}

/** The last `months` calendar months up to `today`'s month: first day .. last day. */
export function lastMonthsRange(today: string, months: number): { from: string; to: string } {
  const current = periodOf(today);
  return {
    from: periodStart(addPeriods(current, -(Math.max(1, months) - 1))),
    to: periodEnd(current),
  };
}
