import { describe, expect, it } from 'vitest';
import type { InventoryCycle, VehicleExpense } from '../types';
import { canConsign, openCycleOf, returnableCycle, summarizeExpenses } from './vehicleRules';

function cycle(over: Partial<InventoryCycle>): InventoryCycle {
  return {
    id: 'cyc_1',
    kind: 'OWNED',
    startedAt: '2026-01-01',
    endedAt: null,
    endReason: null,
    consignorId: null,
    askingPrice: null,
    minNetToConsignor: null,
    commissionMode: null,
    commissionValue: null,
    agreementEndsAt: null,
    expenseTotal: 0,
    ...over,
  };
}

describe('vehicle rules', () => {
  it('consigns only without an open cycle, and not leased / scrapped cars', () => {
    const closed = [cycle({ endedAt: '2026-05-01', endReason: 'SOLD' })];
    expect(
      canConsign({ openCycle: null, cycles: closed, ownership: 'OWNED', status: 'SOLD' }),
    ).toBe(true);
    expect(
      canConsign({ openCycle: null, cycles: [], ownership: 'THIRD_PARTY', status: 'EXTERNAL' }),
    ).toBe(true);
    expect(
      canConsign({ openCycle: null, cycles: [], ownership: 'THIRD_PARTY', status: 'IN_STOCK' }),
    ).toBe(false);
    expect(
      canConsign({ openCycle: null, cycles: [cycle({})], ownership: 'OWNED', status: 'IN_STOCK' }),
    ).toBe(false);
    expect(canConsign({ openCycle: null, cycles: [], ownership: 'OWNED', status: 'LEASED' })).toBe(
      false,
    );
    expect(
      canConsign({ openCycle: null, cycles: [], ownership: 'OWNED', status: 'SCRAPPED' }),
    ).toBe(false);
  });

  it('returns to the consignor only an open CONSIGNED cycle', () => {
    const consigned = cycle({ id: 'cyc_2', kind: 'CONSIGNED' });
    expect(returnableCycle({ openCycle: null, cycles: [consigned] })?.id).toBe('cyc_2');
    expect(returnableCycle({ openCycle: null, cycles: [cycle({})] })).toBeNull();
    expect(returnableCycle({ openCycle: null, cycles: [] })).toBeNull();
    expect(
      openCycleOf({ openCycle: null, cycles: [cycle({ endedAt: '2026-02-01' }), consigned] })?.id,
    ).toBe('cyc_2');
  });

  it('totals expenses per category in category order', () => {
    const e = (category: VehicleExpense['category'], amount: number) =>
      ({ id: `${category}-${amount}`, category, amount }) as VehicleExpense;
    expect(summarizeExpenses([e('TEST', 450), e('REPAIR', 100.1), e('REPAIR', 0.2)])).toEqual({
      total: 550.3,
      byCategory: [
        { category: 'REPAIR', total: 100.3 },
        { category: 'TEST', total: 450 },
      ],
    });
  });
});
