import { cyclePnl, expenseCost, type CyclePnlInput } from './pnl';

const owned: CyclePnlInput = {
  kind: 'OWNED',
  open: false,
  purchase: { price: 50_000, vatMode: 'NONE', vatRate: 18 },
  sale: { price: 59_000, vatMode: 'MARGIN', vatRate: 18, commissionAmount: null },
  listingPrice: 61_000,
  consignment: null,
  expenses: [],
  vatRate: 18,
  leaseIncome: 0,
  rebilled: 0,
};

describe('expenseCost', () => {
  it('counts only expenses paid by us, net of reclaimable VAT', () => {
    expect(
      expenseCost(
        [
          { amount: 1180, paidBy: 'US', vatIncluded: true, vatReclaimable: true },
          { amount: 300, paidBy: 'US', vatIncluded: true, vatReclaimable: false },
          { amount: 1000, paidBy: 'US', vatIncluded: false, vatReclaimable: true },
          { amount: 500, paidBy: 'DRIVER', vatIncluded: true, vatReclaimable: false },
          { amount: 700, paidBy: 'CONSIGNOR', vatIncluded: true, vatReclaimable: false },
        ],
        18,
      ),
    ).toBe(2300);
  });
});

describe('cyclePnl', () => {
  it('sold OWNED cycle: sale + lease income + rebilled vs purchase + expenses + margin VAT', () => {
    const pnl = cyclePnl({
      ...owned,
      expenses: [
        { amount: 1180, paidBy: 'US', vatIncluded: true, vatReclaimable: true },
        { amount: 300, paidBy: 'US', vatIncluded: true, vatReclaimable: false },
        { amount: 500, paidBy: 'DRIVER', vatIncluded: true, vatReclaimable: false },
      ],
      leaseIncome: 2000,
      rebilled: 500,
    });
    expect(pnl).toEqual({
      purchasePrice: 50_000,
      salePrice: 59_000,
      listingPrice: 61_000,
      commission: null,
      revenue: { sale: 59_000, commission: 0, leaseIncome: 2000, rebilled: 500, total: 61_500 },
      costs: { purchase: 50_000, expenses: 1300, vatOnMargin: 1372.88, total: 52_672.88 },
      profit: 8827.12,
      unrealised: false,
    });
  });

  it('negative margin owes no VAT', () => {
    const pnl = cyclePnl({
      ...owned,
      sale: { price: 48_000, vatMode: 'MARGIN', vatRate: 18, commissionAmount: null },
    });
    expect(pnl.costs.vatOnMargin).toBe(0);
    expect(pnl.profit).toBe(-2000);
  });

  it('FULL VAT purchase and sale: output VAT minus the reclaimed input VAT', () => {
    const pnl = cyclePnl({
      ...owned,
      purchase: { price: 92_000, vatMode: 'FULL', vatRate: 18 },
      sale: { price: 107_500, vatMode: 'FULL', vatRate: 18, commissionAmount: null },
    });
    // 16,398.31 - 14,033.90 = 15,500 x 18 / 118
    expect(pnl.costs.vatOnMargin).toBe(2364.41);
    expect(pnl.profit).toBe(13_135.59);
  });

  it('open cycle: listing price as unrealised sale, lease income included', () => {
    const pnl = cyclePnl({
      ...owned,
      open: true,
      sale: null,
      purchase: { price: 38_000, vatMode: 'NONE', vatRate: 18 },
      listingPrice: 46_900,
      leaseIncome: 12_400.5,
    });
    expect(pnl).toMatchObject({
      salePrice: null,
      unrealised: true,
      revenue: { sale: 46_900, leaseIncome: 12_400.5, total: 59_300.5 },
      costs: { purchase: 38_000, vatOnMargin: 1357.63, total: 39_357.63 },
      profit: 19_942.87,
    });
    // Without a listing price nothing is assumed about the sale.
    const bare = cyclePnl({ ...owned, open: true, sale: null, listingPrice: null });
    expect(bare.revenue.sale).toBe(0);
    expect(bare.costs.vatOnMargin).toBe(0);
    expect(bare.profit).toBe(-50_000);
  });

  it('stock without a purchase deal (seeded taxi) earns its lease income', () => {
    const pnl = cyclePnl({
      ...owned,
      open: true,
      purchase: null,
      sale: null,
      listingPrice: null,
      leaseIncome: 18_000,
      rebilled: 250,
      expenses: [{ amount: 450, paidBy: 'US', vatIncluded: true, vatReclaimable: false }],
    });
    expect(pnl).toMatchObject({
      purchasePrice: null,
      revenue: { total: 18_250 },
      costs: { purchase: 0, expenses: 450, total: 450 },
      profit: 17_800,
    });
  });

  it('CONSIGNED: the commission is the revenue; no purchase, no VAT line', () => {
    const consigned: CyclePnlInput = {
      ...owned,
      kind: 'CONSIGNED',
      purchase: null,
      consignment: { commissionMode: 'SURPLUS', commissionValue: null, minNetToConsignor: 120_000 },
      expenses: [{ amount: 350, paidBy: 'US', vatIncluded: true, vatReclaimable: false }],
    };
    const sold = cyclePnl({
      ...consigned,
      sale: { price: 128_000, vatMode: 'NONE', vatRate: 18, commissionAmount: 8000 },
    });
    expect(sold).toMatchObject({
      commission: 8000,
      revenue: { sale: 0, commission: 8000, total: 8000 },
      costs: { purchase: 0, expenses: 350, vatOnMargin: 0, total: 350 },
      profit: 7650,
      unrealised: false,
    });
    const open = cyclePnl({ ...consigned, open: true, sale: null, listingPrice: 132_000 });
    expect(open).toMatchObject({ commission: 12_000, unrealised: true, profit: 11_650 });
  });
});
