import { prorate, sumMoney } from '@renawi/shared';
import {
  BillingContract,
  BillingSegment,
  depositApplyAmount,
  penaltyAmount,
  planRebill,
  planRentCharges,
  planRentPeriod,
  rentDueDate,
  unusedRentCredits,
} from './billing-plan';

const contract = (over: Partial<BillingContract> = {}): BillingContract => ({
  type: 'CAR_AND_NUMBER',
  startDate: '2026-10-16',
  endDate: '2027-10-15',
  actualEndDate: null,
  paymentDay: 10,
  ...over,
});

const seg = (over: Partial<BillingSegment> = {}): BillingSegment => ({
  id: 's1',
  taxiLicenseId: 'tl1',
  vehicleId: 'v1',
  monthlyRent: 6500,
  startDate: '2026-10-16',
  endDate: null,
  ...over,
});

describe('prorate (shared)', () => {
  it('prorates by days of the month and keeps a full month exact', () => {
    expect(prorate(6500, 16, 31)).toBe(3354.84);
    expect(prorate(6500, 31, 31)).toBe(6500);
    expect(prorate(1000.01, 30, 30)).toBe(1000.01);
    expect(prorate(1000, 0, 30)).toBe(0);
    expect(prorate('1350.00', 11, 31)).toBe(479.03);
  });

  it('rejects impossible inputs', () => {
    expect(() => prorate(100, 32, 31)).toThrow(RangeError);
    expect(() => prorate(100, 1, 27)).toThrow(RangeError);
  });
});

describe('rentDueDate', () => {
  it('clamps the payment day into the month but never before the first billed day', () => {
    expect(rentDueDate('2026-11', 10, '2026-11-01')).toBe('2026-11-10');
    expect(rentDueDate('2026-10', 10, '2026-10-16')).toBe('2026-10-16');
    expect(rentDueDate('2027-02', 28, '2027-02-01')).toBe('2027-02-28');
    expect(rentDueDate('2026-11', 1, '2026-11-12')).toBe('2026-11-12');
  });
});

describe('planRentPeriod / planRentCharges', () => {
  it('prorates a start on the 16th of a 31-day month and bills later months in full', () => {
    const lines = planRentCharges(contract(), [seg()], '2026-12');
    expect(lines.map((l) => [l.rentPeriod, l.date, l.dueDate, l.amount, l.days])).toEqual([
      ['2026-10', '2026-10-16', '2026-10-16', 3354.84, 16],
      ['2026-11', '2026-11-01', '2026-11-10', 6500, 30],
      ['2026-12', '2026-12-01', '2026-12-10', 6500, 31],
    ]);
    expect(lines[0]).toMatchObject({ segmentId: 's1', vehicleId: 'v1', taxiLicenseId: 'tl1' });
  });

  it('splits a month with a mid-month car swap into two lines that sum to the rent', () => {
    const segments = [
      seg({ id: 'a', startDate: '2026-10-16', endDate: '2026-11-09' }),
      seg({ id: 'b', vehicleId: 'v2', startDate: '2026-11-10' }),
    ];
    const nov = planRentPeriod(contract(), segments, '2026-11');
    expect(nov.map((l) => [l.segmentId, l.vehicleId, l.date, l.to, l.days])).toEqual([
      ['a', 'v1', '2026-11-01', '2026-11-09', 9],
      ['b', 'v2', '2026-11-10', '2026-11-30', 21],
    ]);
    expect(nov[0]?.amount).toBe(prorate(6500, 9, 30));
    expect(sumMoney(nov.map((l) => l.amount))).toBe(6500);
    // The swap line is due on the payment day only if that is not before its first day.
    expect(nov.map((l) => l.dueDate)).toEqual(['2026-11-10', '2026-11-10']);
  });

  it('absorbs the rounding in the last line when both halves round up', () => {
    // 100.01 over 2 x 15 days of a 30-day month: 50.005 + 50.005 -> 50.01 + 50.00.
    const segments = [
      seg({ id: 'a', monthlyRent: 100.01, startDate: '2026-11-01', endDate: '2026-11-15' }),
      seg({ id: 'b', monthlyRent: 100.01, startDate: '2026-11-16' }),
    ];
    const lines = planRentPeriod(contract({ startDate: '2026-11-01' }), segments, '2026-11');
    expect(lines.map((l) => l.amount)).toEqual([50.01, 50]);
  });

  it('bills a rent change pro rata per segment', () => {
    const segments = [
      seg({ id: 'a', monthlyRent: 6000, startDate: '2026-10-16', endDate: '2026-11-15' }),
      seg({ id: 'b', monthlyRent: 7500, startDate: '2026-11-16' }),
    ];
    const nov = planRentPeriod(contract(), segments, '2026-11');
    expect(nov.map((l) => l.amount)).toEqual([3000, 3750]);
  });

  it('stops at the actual end date and outside the contract range', () => {
    const c = contract({ actualEndDate: '2026-11-20' });
    expect(planRentPeriod(c, [seg({ endDate: '2026-11-20' })], '2026-11')).toEqual([
      expect.objectContaining({ days: 20, amount: prorate(6500, 20, 30), to: '2026-11-20' }),
    ]);
    expect(planRentPeriod(c, [seg()], '2026-12')).toEqual([]);
    expect(planRentPeriod(contract(), [seg()], '2026-09')).toEqual([]);
    expect(planRentCharges(c, [seg()], '2027-03').map((l) => l.rentPeriod)).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });

  it('attributes NUMBER_ONLY rent to the licence only', () => {
    const lines = planRentPeriod(contract({ type: 'NUMBER_ONLY' }), [seg()], '2026-11');
    expect(lines[0]).toMatchObject({ vehicleId: null, taxiLicenseId: 'tl1' });
  });
});

describe('planRebill', () => {
  it('keeps matching charges, voids changed ones and creates the new lines', () => {
    const segments = [
      seg({ id: 'a', startDate: '2026-10-16', endDate: '2026-11-09' }),
      seg({ id: 'b', vehicleId: 'v2', startDate: '2026-11-10' }),
    ];
    const plan = planRebill(
      contract(),
      segments,
      ['2026-10', '2026-11'],
      [
        { id: 'oct', segmentId: 'a', rentPeriod: '2026-10', amount: '3354.84' },
        { id: 'nov', segmentId: 'a', rentPeriod: '2026-11', amount: '6500.00' },
      ],
    );
    expect(plan.voidIds).toEqual(['nov']);
    expect(plan.create.map((l) => [l.segmentId, l.rentPeriod, l.amount])).toEqual([
      ['a', '2026-11', 1950],
      ['b', '2026-11', 4550],
    ]);
  });
});

describe('end of contract', () => {
  it('credits the charged days after the actual end date', () => {
    const ended = contract({ startDate: '2026-10-16', actualEndDate: '2026-11-20' });
    const credits = unusedRentCredits(
      ended,
      [seg({ endDate: '2026-11-20' })],
      [
        { id: 'oct', segmentId: 's1', rentPeriod: '2026-10', amount: 3354.84 },
        { id: 'nov', segmentId: 's1', rentPeriod: '2026-11', amount: 6500 },
      ],
    );
    expect(credits).toEqual([
      {
        rentPeriod: '2026-11',
        from: '2026-11-21',
        to: '2026-11-30',
        amount: 2166.67, // 6500 - prorate(6500, 20, 30) = 6500 - 4333.33
      },
    ]);
  });

  it('credits a whole month charged after the end date and nothing when nothing is unused', () => {
    const ended = contract({ startDate: '2026-10-16', actualEndDate: '2026-11-30' });
    const segments = [seg({ endDate: '2026-11-30' })];
    expect(
      unusedRentCredits(ended, segments, [
        { id: 'nov', segmentId: 's1', rentPeriod: '2026-11', amount: 6500 },
        { id: 'dec', segmentId: 's1', rentPeriod: '2026-12', amount: 6500 },
      ]),
    ).toEqual([{ rentPeriod: '2026-12', from: '2026-12-01', to: '2026-12-31', amount: 6500 }]);
    expect(
      unusedRentCredits(ended, segments, [
        { id: 'nov', segmentId: 's1', rentPeriod: '2026-11', amount: 6500 },
      ]),
    ).toEqual([]);
  });

  it('computes the early-exit penalty in months of rent', () => {
    expect(penaltyAmount(1, 6500)).toBe(6500);
    expect(penaltyAmount('1.5', '1350.00')).toBe(2025);
    expect(penaltyAmount(0, 6500)).toBe(0);
    expect(penaltyAmount(0.33, 1000.01)).toBe(330);
  });

  it('applies min(held, balance) of the deposit, never a negative amount', () => {
    expect(depositApplyAmount(5000, 8500)).toBe(5000);
    expect(depositApplyAmount(5000, 1234.56)).toBe(1234.56);
    expect(depositApplyAmount(5000, 0)).toBe(0);
    expect(depositApplyAmount(5000, -200)).toBe(0);
    expect(depositApplyAmount(0, 300)).toBe(0);
  });
});
