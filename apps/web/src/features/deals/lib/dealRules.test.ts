import { describe, expect, it } from 'vitest';
import {
  cashDue,
  commissionPreview,
  completionBlockers,
  computeSaleVat,
  daysInStock,
  defaultPaymentDirection,
  listGapPercent,
  newDealPath,
  suggestedPaymentAmount,
  transferDueDate,
  transferProgress,
} from './dealRules';

describe('listGapPercent', () => {
  it('is the signed gap to the list price, one decimal', () => {
    expect(listGapPercent(92000, 100000)).toBe(-8);
    expect(listGapPercent(103250, 100000)).toBe(3.3);
    expect(listGapPercent(100000, 100000)).toBe(0);
  });
  it('is null without a list price or a price', () => {
    expect(listGapPercent(90000, null)).toBeNull();
    expect(listGapPercent(90000, 0)).toBeNull();
    expect(listGapPercent(null, 100000)).toBeNull();
  });
});

describe('cashDue', () => {
  it('is the price minus the trade-in value, exact to the agora', () => {
    expect(cashDue(80000, 20000)).toBe(60000);
    expect(cashDue(0.3, 0.1)).toBe(0.2);
    expect(cashDue(80000, null)).toBe(80000);
    expect(cashDue(null, 1000)).toBeNull();
  });
});

describe('computeSaleVat', () => {
  it('margin: VAT contained in the profit over the purchase price', () => {
    expect(computeSaleVat('MARGIN', 80000, 60000, 18)).toEqual({ base: 20000, amount: 3050.85 });
    expect(computeSaleVat('MARGIN', 50000, 60000, 18)).toEqual({ base: 0, amount: 0 });
    expect(computeSaleVat('MARGIN', 80000, null, 18)).toBeNull();
  });
  it('full: VAT contained in the price', () => {
    expect(computeSaleVat('FULL', 80000, null, 18)).toEqual({ base: 80000, amount: 12203.39 });
    expect(computeSaleVat('FULL', null, null, 18)).toBeNull();
  });
});

describe('commissionPreview', () => {
  const terms = {
    commissionMode: 'FIXED' as const,
    commissionValue: 3000,
    minNetToConsignor: 70000,
  };
  it('uses the shared commission rule', () => {
    expect(commissionPreview(terms, 80000)).toEqual({
      commission: 3000,
      payout: 77000,
      belowMinNet: false,
    });
    expect(
      commissionPreview({ ...terms, commissionMode: 'SURPLUS', commissionValue: null }, 76000),
    ).toEqual({ commission: 6000, payout: 70000, belowMinNet: false });
  });
  it('is null without terms, a price, or a minimum for SURPLUS', () => {
    expect(commissionPreview(null, 80000)).toBeNull();
    expect(commissionPreview(terms, null)).toBeNull();
    expect(
      commissionPreview(
        { commissionMode: 'SURPLUS', commissionValue: null, minNetToConsignor: null },
        1,
      ),
    ).toBeNull();
  });
});

describe('transferProgress', () => {
  it('counts the items the API sent (taxi item included only when present)', () => {
    expect(transferProgress({ idCopies: true, liensChecked: false })).toEqual({
      keys: ['idCopies', 'liensChecked'],
      done: 1,
      total: 2,
      complete: false,
    });
    const empty = transferProgress(null);
    expect(empty.total).toBe(7);
    expect(empty.keys).not.toContain('taxiLicenseDetached');
  });
  it('is complete when every item is ticked', () => {
    expect(transferProgress({ idCopies: true, finesChecked: true }).complete).toBe(true);
  });
});

describe('payments', () => {
  it('defaults the direction by deal type and what is due', () => {
    expect(defaultPaymentDirection({ type: 'PURCHASE', balanceDue: 1000, payoutDue: null })).toBe(
      'OUT',
    );
    expect(defaultPaymentDirection({ type: 'SALE', balanceDue: 1000, payoutDue: null })).toBe('IN');
    expect(
      defaultPaymentDirection({ type: 'CONSIGNMENT_SALE', balanceDue: 0, payoutDue: 76000 }),
    ).toBe('OUT');
  });
  it('suggests what is still due in that direction', () => {
    const sale = { type: 'SALE' as const, balanceDue: 60000, payoutDue: null };
    expect(suggestedPaymentAmount(sale, 'IN')).toBe(60000);
    expect(suggestedPaymentAmount(sale, 'OUT')).toBeNull();
    const consignment = { type: 'CONSIGNMENT_SALE' as const, balanceDue: 0, payoutDue: 76000 };
    expect(suggestedPaymentAmount(consignment, 'OUT')).toBe(76000);
  });
});

describe('completionBlockers', () => {
  it('needs the disclosure for sales and a car that is not leased', () => {
    expect(completionBlockers({ type: 'SALE', disclosureSignedAt: null }, 'LEASED')).toEqual([
      'disclosureMissing',
      'vehicleLeased',
    ]);
    expect(
      completionBlockers({ type: 'SALE', disclosureSignedAt: '2026-11-01T10:00:00Z' }, 'RESERVED'),
    ).toEqual([]);
    expect(completionBlockers({ type: 'PURCHASE', disclosureSignedAt: null }, 'EXTERNAL')).toEqual(
      [],
    );
  });
});

describe('dates and links', () => {
  it('transfer due date is 6 working days after the sale', () => {
    // Thursday + 6 working days (Friday / Saturday off) = Sunday a week later.
    expect(transferDueDate('2026-11-05')).toBe('2026-11-15');
  });
  it('days in stock never go negative', () => {
    expect(daysInStock('2026-11-01', '2026-11-07')).toBe(6);
    expect(daysInStock('2026-11-09', '2026-11-07')).toBe(0);
    expect(daysInStock(null, '2026-11-07')).toBeNull();
  });
  it('builds the new-deal link with the car', () => {
    expect(newDealPath('SALE', 'veh_1')).toBe('/deals/new?type=SALE&vehicleId=veh_1');
    expect(newDealPath('PURCHASE')).toBe('/deals/new?type=PURCHASE');
  });
});
