import { INVENTORY_AGE_BUCKETS, inventoryAgeBucket } from '@renawi/shared';
import {
  aggregateProfit,
  col,
  daysBetween,
  lastMonthsRange,
  periodKey,
  periodKeys,
  resolveRange,
  totalsOf,
  type ProfitCycle,
} from './report-rules';

describe('period grouping', () => {
  it('periodKey: month, quarter, year', () => {
    expect(periodKey('2026-11-12', 'month')).toBe('2026-11');
    expect(periodKey('2026-01-01', 'quarter')).toBe('2026-Q1');
    expect(periodKey('2026-03-31', 'quarter')).toBe('2026-Q1');
    expect(periodKey('2026-04-01', 'quarter')).toBe('2026-Q2');
    expect(periodKey('2026-12-31', 'quarter')).toBe('2026-Q4');
    expect(periodKey('2026-07-15', 'year')).toBe('2026');
  });

  it('periodKeys: every period touched by the range, oldest first, no duplicates', () => {
    expect(periodKeys('2026-01-16', '2026-03-02', 'month')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(periodKeys('2025-11-01', '2026-04-30', 'quarter')).toEqual([
      '2025-Q4',
      '2026-Q1',
      '2026-Q2',
    ]);
    expect(periodKeys('2024-12-31', '2026-01-01', 'year')).toEqual(['2024', '2025', '2026']);
    expect(periodKeys('2026-05-10', '2026-05-20', 'month')).toEqual(['2026-05']);
  });

  it('resolveRange: defaults to 1 January .. today, swaps a reversed range', () => {
    expect(resolveRange(undefined, undefined, '2026-11-12')).toEqual({
      from: '2026-01-01',
      to: '2026-11-12',
    });
    expect(resolveRange('2026-06-01', undefined, '2026-11-12')).toEqual({
      from: '2026-06-01',
      to: '2026-11-12',
    });
    expect(resolveRange('2026-10-01', '2026-02-01', '2026-11-12')).toEqual({
      from: '2026-02-01',
      to: '2026-10-01',
    });
  });

  it('lastMonthsRange: first day of the oldest month .. last day of the current month', () => {
    expect(lastMonthsRange('2026-11-12', 6)).toEqual({ from: '2026-06-01', to: '2026-11-30' });
    expect(lastMonthsRange('2026-02-10', 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(lastMonthsRange('2026-02-10', 0)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('ageing buckets', () => {
  it('days in stock: 0-30, 31-60, 61-90, 90+ (boundaries inclusive)', () => {
    expect(INVENTORY_AGE_BUCKETS).toEqual(['0-30', '31-60', '61-90', '90+']);
    expect(inventoryAgeBucket(-2)).toBe('0-30');
    expect(inventoryAgeBucket(0)).toBe('0-30');
    expect(inventoryAgeBucket(30)).toBe('0-30');
    expect(inventoryAgeBucket(31)).toBe('31-60');
    expect(inventoryAgeBucket(60)).toBe('31-60');
    expect(inventoryAgeBucket(61)).toBe('61-90');
    expect(inventoryAgeBucket(90)).toBe('61-90');
    expect(inventoryAgeBucket(91)).toBe('90+');
    expect(inventoryAgeBucket(400)).toBe('90+');
  });

  it('daysBetween never goes negative', () => {
    expect(daysBetween('2026-11-01', '2026-11-12')).toBe(11);
    expect(daysBetween('2026-11-12', '2026-11-12')).toBe(0);
    expect(daysBetween('2026-11-12', '2026-11-01')).toBe(0);
  });
});

describe('totals and columns', () => {
  it('col: label is the i18n key, enum name kept', () => {
    expect(col('amount', 'money')).toEqual({
      key: 'amount',
      label: 'reports.columns.amount',
      type: 'money',
    });
    expect(col('status', 'enum', 'FineStatus')).toMatchObject({ enum: 'FineStatus' });
  });

  it('totalsOf: sums money / int columns (skipping n/a), null elsewhere or when all missing', () => {
    const columns = [
      col('plateNo', 'plate'),
      col('amount', 'money'),
      col('count', 'int'),
      col('paid', 'money'),
    ];
    const totals = totalsOf(columns, [
      { plateNo: '1', amount: 0.1, count: 2, paid: null },
      { plateNo: '2', amount: 0.2, count: 3, paid: null },
      { plateNo: '3', amount: null, count: 1, paid: null },
    ]);
    expect(totals).toEqual({ plateNo: null, amount: 0.3, count: 6, paid: null });
  });
});

describe('aggregateProfit', () => {
  const cycle = (over: Partial<ProfitCycle>): ProfitCycle => ({
    endedAt: '2026-02-10',
    sale: 0,
    commission: 0,
    purchase: 0,
    expenses: 0,
    rebilled: 0,
    vat: 0,
    ...over,
  });

  it('groups closed cycles and lease income per period; empty periods are zeros', () => {
    const rows = aggregateProfit(
      [
        cycle({
          endedAt: '2026-01-20',
          sale: 59_000,
          purchase: 50_000,
          expenses: 1_000,
          vat: 1_372.88,
        }),
        cycle({ endedAt: '2026-03-05', commission: 4_000, expenses: 500, rebilled: 200 }),
        cycle({ endedAt: '2025-12-31', sale: 99_999 }), // outside the range
      ],
      [
        { date: '2026-01-10', type: 'CHARGE', amount: 6_000 },
        { date: '2026-01-31', type: 'CREDIT', amount: '1000.50' },
        { date: '2026-03-01', type: 'CHARGE', amount: 6_000 },
      ],
      '2026-01-01',
      '2026-03-31',
      'month',
    );
    expect(rows.map((r) => r.period)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(rows[0]).toEqual({
      period: '2026-01',
      salesRevenue: 59_000,
      purchaseCost: 50_000,
      expenses: 1_000,
      vatOnMargin: 1_372.88,
      commission: 0,
      leaseIncome: 4_999.5,
      profit: 11_626.62,
    });
    expect(rows[1]).toMatchObject({ salesRevenue: 0, leaseIncome: 0, profit: 0 });
    expect(rows[2]).toMatchObject({
      commission: 4_000,
      expenses: 300,
      leaseIncome: 6_000,
      profit: 9_700,
    });
  });

  it('quarter grouping puts both months in one row', () => {
    const rows = aggregateProfit(
      [cycle({ endedAt: '2026-01-20', sale: 10 }), cycle({ endedAt: '2026-03-20', sale: 20 })],
      [],
      '2026-01-01',
      '2026-06-30',
      'quarter',
    );
    expect(rows.map((r) => [r.period, r.salesRevenue])).toEqual([
      ['2026-Q1', 30],
      ['2026-Q2', 0],
    ]);
  });
});
