import { Prisma } from '@prisma/client';
import {
  summarizeExpenses,
  toCycleViews,
  toListItemBase,
  type CycleWithConsignor,
  type VehicleWithRefs,
} from './vehicle-views';

const d = (v: number | string) => new Prisma.Decimal(v);

describe('summarizeExpenses', () => {
  it('sums all / paid-by-us and groups by category in enum order', () => {
    const summary = summarizeExpenses([
      { category: 'TEST', amount: d('1100.00'), paidBy: 'DRIVER' },
      { category: 'REPAIR', amount: d('1250.50'), paidBy: 'US' },
      { category: 'FUEL', amount: d('0.10'), paidBy: 'US' },
      { category: 'REPAIR', amount: d('0.20'), paidBy: 'CONSIGNOR' },
    ]);
    expect(summary.total.toString()).toBe('2350.8');
    expect(summary.paidByUs.toString()).toBe('1250.6');
    expect(summary.count).toBe(4);
    expect(summary.byCategory.map((c) => [c.category, c.total.toString()])).toEqual([
      ['REPAIR', '1250.7'],
      ['TEST', '1100'],
      ['FUEL', '0.1'],
    ]);
  });

  it('is all zeros without expenses', () => {
    const summary = summarizeExpenses([]);
    expect([summary.total.toNumber(), summary.paidByUs.toNumber(), summary.count]).toEqual([
      0, 0, 0,
    ]);
    expect(summary.byCategory).toEqual([]);
  });
});

describe('toCycleViews', () => {
  const cycle = (
    id: string,
    consignor: CycleWithConsignor['consignor'] = null,
  ): CycleWithConsignor => ({
    id,
    vehicleId: 'v1',
    kind: consignor ? 'CONSIGNED' : 'OWNED',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    endedAt: null,
    endReason: null,
    purchaseDealId: null,
    saleDealId: null,
    consignorId: consignor?.id ?? null,
    consignor,
    askingPrice: null,
    minNetToConsignor: null,
    commissionMode: null,
    commissionValue: null,
    agreementEndsAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('attaches per-cycle totals and the consignor ref', () => {
    const views = toCycleViews(
      [
        cycle('c2', { id: 'k1', firstName: 'سامر', lastName: 'نصار', companyName: null }),
        cycle('c1'),
      ],
      [
        { cycleId: 'c1', paidBy: 'US', _sum: { amount: d(100) } },
        { cycleId: 'c1', paidBy: 'DRIVER', _sum: { amount: d(40) } },
        { cycleId: null, paidBy: 'US', _sum: { amount: d(999) } },
        { cycleId: 'c2', paidBy: 'CONSIGNOR', _sum: { amount: null } },
      ],
    );
    expect(
      views.map((v) => [v.id, v.expenseTotal.toNumber(), v.expensePaidByUs.toNumber()]),
    ).toEqual([
      ['c2', 0, 0],
      ['c1', 140, 100],
    ]);
    expect(views[0]?.consignor).toEqual({ id: 'k1', name: 'سامر نصار' });
    expect(views[1]?.consignor).toBeNull();
    expect(views[0]).not.toHaveProperty('_sum');
  });
});

describe('toListItemBase', () => {
  it('flattens the loaded relations into refs', () => {
    const row = {
      id: 'v1',
      plateNo: '1234567',
      registeredLicense: null,
      ownerDriver: {
        id: 'drv1',
        contact: { id: 'c1', firstName: null, lastName: null, companyName: 'מוניות הגליל' },
      },
      cycles: [{ id: 'cyc1', kind: 'OWNED', startedAt: new Date('2026-11-07T00:00:00.000Z') }],
    } as unknown as VehicleWithRefs;
    const item = toListItemBase(row);
    expect(item).toMatchObject({
      id: 'v1',
      registeredLicense: null,
      ownerDriver: { id: 'drv1', name: 'מוניות הגליל' },
      openCycle: { id: 'cyc1', kind: 'OWNED' },
    });
    expect(item).not.toHaveProperty('cycles');
    expect(toListItemBase({ ...row, ownerDriver: null, cycles: [] }).openCycle).toBeNull();
  });
});
