import { computeCommission, createTransferChecklist, vatOnMargin } from '@renawi/shared';
import { rebillChargeKind } from '../vehicles/expenses.service';
import {
  consignmentAmounts,
  dealAlerts,
  dealMoney,
  dealVat,
  mergeTransferChecklist,
  purchaseVatMode,
  rollUpTransfer,
  saleVatMode,
  transferDueDate,
  type DealAlertInput,
} from './deal-rules';

const T = '2026-11-07'; // Saturday

describe('VAT', () => {
  it('vatOnMargin: margin x r / (100 + r), negative or zero margin owes nothing', () => {
    expect(vatOnMargin(59_000, 50_000, 18)).toBe(1372.88);
    expect(vatOnMargin(45_000, 50_000, 18)).toBe(0);
    expect(vatOnMargin(50_000, 50_000, 18)).toBe(0);
    expect(vatOnMargin(50_000.01, 50_000, 18)).toBe(0);
    expect(vatOnMargin(118, 0, 18)).toBe(18);
  });

  it('dealVat MARGIN uses the purchase price as the base offset', () => {
    expect(dealVat('MARGIN', 18, 59_000, 50_000)).toEqual({
      mode: 'MARGIN',
      rate: 18,
      base: 9000,
      amount: 1372.88,
    });
    expect(dealVat('MARGIN', 18, 45_000, 50_000)).toEqual({
      mode: 'MARGIN',
      rate: 18,
      base: 0,
      amount: 0,
    });
    // Unknown purchase price: the whole price is margin.
    expect(dealVat('MARGIN', 18, 11_800, null)).toMatchObject({ base: 11_800, amount: 1800 });
  });

  it('dealVat FULL is the VAT contained in the full price; NONE is zero', () => {
    expect(dealVat('FULL', 18, 59_000, 50_000)).toEqual({
      mode: 'FULL',
      rate: 18,
      base: 59_000,
      amount: 9000,
    });
    expect(dealVat('FULL', 17, 117_000, null).amount).toBe(17_000);
    expect(dealVat('NONE', 18, 59_000, 50_000)).toEqual({
      mode: 'NONE',
      rate: 18,
      base: 0,
      amount: 0,
    });
  });

  it('a purchase from a VAT-registered business forces FULL on the sale', () => {
    expect(saleVatMode(undefined, false)).toBe('MARGIN');
    expect(saleVatMode('FULL', false)).toBe('FULL');
    expect(saleVatMode('MARGIN', true)).toBe('FULL');
    expect(purchaseVatMode(true)).toBe('FULL');
    expect(purchaseVatMode(false)).toBe('NONE');
  });
});

describe('consignment commission', () => {
  it('computeCommission: FIXED, PERCENT and SURPLUS over the minimum net', () => {
    expect(computeCommission('FIXED', 3000, 50_000)).toMatchObject({
      commission: 3000,
      payout: 47_000,
    });
    expect(computeCommission('PERCENT', 5, 128_000)).toMatchObject({
      commission: 6400,
      payout: 121_600,
    });
    expect(computeCommission('SURPLUS', null, 128_000, 120_000)).toMatchObject({
      commission: 8000,
      payout: 120_000,
      belowMinNet: false,
    });
    // Sold below the minimum net: no surplus, the consignor gets everything.
    expect(computeCommission('SURPLUS', null, 118_000, 120_000)).toMatchObject({
      commission: 0,
      payout: 118_000,
      belowMinNet: true,
    });
  });

  it('consignmentAmounts reads the cycle rule; no rule earns nothing', () => {
    const rule = { commissionMode: 'SURPLUS' as const, commissionValue: null };
    expect(consignmentAmounts({ ...rule, minNetToConsignor: 120_000 }, 131_500)).toEqual({
      commission: 11_500,
      payout: 120_000,
    });
    expect(consignmentAmounts({ ...rule, minNetToConsignor: null }, 131_500)).toEqual({
      commission: 0,
      payout: 131_500,
    });
    expect(
      consignmentAmounts(
        { commissionMode: 'PERCENT', commissionValue: 2.5, minNetToConsignor: null },
        33_333,
      ),
    ).toEqual({ commission: 833.33, payout: 32_499.67 });
    expect(
      consignmentAmounts(
        { commissionMode: null, commissionValue: null, minNetToConsignor: null },
        1000,
      ),
    ).toEqual({ commission: 0, payout: 1000 });
  });
});

describe('transfer deadline (6 working days, Sun-Thu week)', () => {
  it('skips Friday and Saturday', () => {
    // Thursday + 6 working days: Sun, Mon, Tue, Wed, Thu, Sun -> the Sunday after next.
    expect(transferDueDate('2026-11-05')).toBe('2026-11-15');
    // Friday / Saturday sales count from Sunday.
    expect(transferDueDate('2026-11-06')).toBe('2026-11-15');
    expect(transferDueDate(T)).toBe('2026-11-15');
    // Sunday + 6: Mon .. Thu, Sun, Mon.
    expect(transferDueDate('2026-11-08')).toBe('2026-11-16');
    // Across a month end.
    expect(transferDueDate('2026-11-26')).toBe('2026-12-06');
  });
});

describe('dealMoney', () => {
  it('sale with a trade-in: cash due = price - trade-in - paid', () => {
    const m = dealMoney({ type: 'SALE', price: 100_000, payoutAmount: null }, [
      { direction: 'IN', method: 'TRADE_IN', amount: 30_000 },
      { direction: 'IN', method: 'CASH', amount: 10_000 },
      { direction: 'IN', method: 'BANK_TRANSFER', amount: 40_000.5 },
    ]);
    expect(m).toEqual({
      paidIn: 50_000.5,
      paidOut: 0,
      tradeInValue: 30_000,
      balanceDue: 19_999.5,
      payoutDue: null,
    });
  });

  it('the trade-in purchase is settled by its TRADE_IN payment', () => {
    expect(
      dealMoney({ type: 'PURCHASE', price: 30_000, payoutAmount: null }, [
        { direction: 'OUT', method: 'TRADE_IN', amount: 30_000 },
      ]),
    ).toEqual({ paidIn: 0, paidOut: 0, tradeInValue: 30_000, balanceDue: 0, payoutDue: null });
    expect(
      dealMoney({ type: 'PURCHASE', price: 72_000, payoutAmount: null }, [
        { direction: 'OUT', method: 'CASH', amount: 20_000 },
      ]).balanceDue,
    ).toBe(52_000);
  });

  it('consignment: buyer due and payout due to the consignor', () => {
    expect(
      dealMoney({ type: 'CONSIGNMENT_SALE', price: 128_000, payoutAmount: 121_600 }, [
        { direction: 'IN', method: 'CREDIT_CARD', amount: 5000 },
        { direction: 'OUT', method: 'BANK_TRANSFER', amount: 100_000 },
      ]),
    ).toEqual({
      paidIn: 5000,
      paidOut: 100_000,
      tradeInValue: 0,
      balanceDue: 123_000,
      payoutDue: 21_600,
    });
  });
});

describe('dealAlerts', () => {
  const base: DealAlertInput = {
    type: 'SALE',
    status: 'COMPLETED',
    hasDisclosure: true,
    transferStatus: 'IN_PROGRESS',
    transferDueAt: '2026-11-20',
    balanceDue: 0,
    payoutDue: null,
  };

  it('flags an open sale without the disclosure form (not purchases)', () => {
    expect(dealAlerts({ ...base, status: 'DRAFT', hasDisclosure: false }, T, 2)).toEqual([
      'disclosureMissing',
    ]);
    expect(
      dealAlerts(
        { ...base, status: 'PENDING', type: 'CONSIGNMENT_SALE', hasDisclosure: false },
        T,
        2,
      ),
    ).toEqual(['disclosureMissing']);
    expect(
      dealAlerts({ ...base, type: 'PURCHASE', status: 'DRAFT', hasDisclosure: false }, T, 2),
    ).toEqual([]);
    expect(dealAlerts({ ...base, status: 'CANCELLED', hasDisclosure: false }, T, 2)).toEqual([]);
  });

  it('transfer due within the lead days, overdue after the deadline, nothing once DONE', () => {
    expect(dealAlerts(base, T, 2)).toEqual([]);
    expect(dealAlerts({ ...base, transferDueAt: '2026-11-09' }, T, 2)).toEqual(['transferDue']);
    expect(dealAlerts({ ...base, transferDueAt: T }, T, 2)).toEqual(['transferDue']);
    expect(dealAlerts({ ...base, transferDueAt: '2026-11-06' }, T, 2)).toEqual(['transferOverdue']);
    expect(
      dealAlerts({ ...base, transferDueAt: '2026-11-06', transferStatus: 'DONE' }, T, 2),
    ).toEqual([]);
  });

  it('unpaid once completed with money owed either way', () => {
    expect(dealAlerts({ ...base, balanceDue: 100 }, T, 2)).toEqual(['unpaid']);
    expect(
      dealAlerts({ ...base, type: 'CONSIGNMENT_SALE', balanceDue: 0, payoutDue: 50 }, T, 2),
    ).toEqual(['unpaid']);
    expect(dealAlerts({ ...base, status: 'DRAFT', balanceDue: 100 }, T, 2)).toEqual([]);
    expect(dealAlerts({ ...base, balanceDue: -10 }, T, 2)).toEqual([]);
  });
});

describe('transfer checklist roll-up', () => {
  const nonTaxiAll = {
    idCopies: true,
    vehicleLicenseSigned: true,
    liensChecked: true,
    finesChecked: true,
    transferFiled: true,
    newLicenseReceived: true,
    insuranceHandled: true,
  };
  const roll = (over: Partial<Parameters<typeof rollUpTransfer>[0]>) =>
    rollUpTransfer({
      storedStatus: 'NOT_STARTED',
      storedTransferredAt: null,
      checklist: createTransferChecklist(),
      isTaxi: false,
      today: T,
      ...over,
    });

  it('none ticked -> NOT_STARTED, some -> IN_PROGRESS, all applicable -> DONE (today)', () => {
    expect(roll({})).toEqual({ status: 'NOT_STARTED', transferredAt: null });
    expect(roll({ checklist: { idCopies: true } })).toEqual({
      status: 'IN_PROGRESS',
      transferredAt: null,
    });
    expect(roll({ checklist: nonTaxiAll })).toEqual({ status: 'DONE', transferredAt: T });
    // Taxis also need the licence detached.
    expect(roll({ checklist: nonTaxiAll, isTaxi: true }).status).toBe('IN_PROGRESS');
    expect(
      roll({ checklist: { ...nonTaxiAll, taxiLicenseDetached: true }, isTaxi: true }).status,
    ).toBe('DONE');
  });

  it('explicit DONE or a transferredAt date means DONE', () => {
    expect(roll({ explicitStatus: 'DONE' })).toEqual({ status: 'DONE', transferredAt: T });
    expect(roll({ explicitTransferredAt: '2026-11-03' })).toEqual({
      status: 'DONE',
      transferredAt: '2026-11-03',
    });
    expect(
      roll({ explicitStatus: 'DONE', storedStatus: 'DONE', storedTransferredAt: '2026-11-01' }),
    ).toEqual({ status: 'DONE', transferredAt: '2026-11-01' });
  });

  it('never lowers implicitly; an explicit status or clearing the date can', () => {
    const done = { storedStatus: 'DONE' as const, storedTransferredAt: '2026-11-01' };
    expect(roll({ ...done, checklist: { idCopies: true } })).toEqual({
      status: 'DONE',
      transferredAt: '2026-11-01',
    });
    expect(roll({ ...done, checklist: { idCopies: true }, explicitStatus: 'IN_PROGRESS' })).toEqual(
      { status: 'IN_PROGRESS', transferredAt: null },
    );
    // An explicit status below what the checklist implies is raised to it.
    expect(roll({ checklist: { idCopies: true }, explicitStatus: 'NOT_STARTED' }).status).toBe(
      'IN_PROGRESS',
    );
    expect(roll({ ...done, checklist: { idCopies: true }, explicitTransferredAt: null })).toEqual({
      status: 'IN_PROGRESS',
      transferredAt: null,
    });
  });

  it('merges stored JSON with the defaults; taxiLicenseDetached only for taxis', () => {
    const merged = mergeTransferChecklist({ idCopies: true, junk: 1 }, false, {
      liensChecked: true,
    });
    expect(merged).toMatchObject({ idCopies: true, liensChecked: true, finesChecked: false });
    expect(merged).not.toHaveProperty('taxiLicenseDetached');
    expect(merged).not.toHaveProperty('junk');
    expect(mergeTransferChecklist(null, true)).toEqual(createTransferChecklist());
    // Malformed stored data falls back to the defaults.
    expect(mergeTransferChecklist({ idCopies: 'yes' }, true)).toEqual(createTransferChecklist());
  });
});

describe('expense rebill charge kind', () => {
  it('follows the shared EXPENSE_TO_CHARGE_KIND table', () => {
    expect(rebillChargeKind('FINE')).toBe('FINE');
    expect(rebillChargeKind('REPAIR')).toBe('REPAIR');
    expect(rebillChargeKind('INSURANCE')).toBe('INSURANCE');
    expect(rebillChargeKind('TEST')).toBe('TEST');
    expect(rebillChargeKind('PARTS')).toBe('REPAIR');
    expect(rebillChargeKind('TOWING')).toBe('REPAIR');
    expect(rebillChargeKind('METER')).toBe('REPAIR');
    expect(rebillChargeKind('FUEL')).toBe('OTHER');
  });
});
