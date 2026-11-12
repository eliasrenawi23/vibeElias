import {
  buildChecklist,
  buildConsignment,
  buildDealPayment,
  buildDepositReceipt,
  buildDisclosure,
  buildLeaseContract,
  buildLedgerPayment,
  buildPurchaseAgreement,
  buildSaleAgreement,
  PdfNotApplicableError,
  type ConsignmentInput,
  type DealInput,
  type DealPaymentInput,
  type LeaseInput,
  type LedgerReceiptInput,
  type PdfContext,
  type PdfVehicle,
} from './pdf-models';
import { PdfTemplateEngine } from './pdf-templates';

/* Fixture entities (plain values, as the loader maps them from Prisma). */

const ctx = (lang: PdfContext['lang'] = 'he'): PdfContext => ({
  lang,
  today: '2026-11-12',
  vatRate: 18,
  business: {
    name: { he: 'רינאוי מוטורס', ar: 'ريناوي موتورز', en: 'Renawi Motors' },
    legalId: '516427184',
    dealerLicenseNo: '2026-0417',
    address: 'רח׳ פאולוס השישי 45, נצרת',
    phone: '046001234',
    email: 'office@renawimotors.co.il',
  },
  leaseClauses: { he: '1. סעיף כללי.', ar: '', en: '1. General clause.' },
});

const corolla: PdfVehicle = {
  plateNo: '31245625',
  make: 'Toyota',
  model: 'Corolla',
  trim: 'Hybrid Sun',
  year: 2023,
  vin: 'JTNB23HE0P3012345',
  color: 'לבן',
  hand: 1,
  km: 128_400,
  fuel: 'HYBRID',
  gearbox: 'AUTO',
  engineCc: 1798,
  testExpiry: '2027-04-06',
  isTaxi: true,
};

const mazda: PdfVehicle = {
  ...corolla,
  plateNo: '57466901',
  make: 'Mazda',
  model: '3',
  trim: null,
  year: 2019,
  vin: 'JM1BP2HLAK1234567',
  hand: 3,
  km: 87_500,
  isTaxi: false,
};

const lease: LeaseInput = {
  id: 'lease1',
  contractNo: 12,
  type: 'CAR_AND_NUMBER',
  status: 'ACTIVE',
  startDate: '2026-08-16',
  endDate: '2027-08-15',
  paymentDay: 10,
  rentIncludesVat: true,
  earlyExitPenaltyMonths: 1.5,
  depositAmount: 5000,
  depositKind: 'CHECK',
  responsibilities: { insurance: 'DRIVER', test: 'US', repairs: 'DRIVER', fines: 'DRIVER' },
  terms: 'משמרת לילה בלבד',
  signedAt: '2026-08-16T08:00:00.000Z',
  handoverChecklist: {
    date: '2026-08-16',
    km: 112_350,
    fuelLevel: 'FULL',
    photosTaken: true,
    spareWheel: false,
  },
  returnChecklist: null,
  lessee: {
    name: 'خالد عودة',
    idNumber: '031745284',
    address: 'حي الصفافرة 12, الناصرة',
    phone: '0527345611',
    licenseNo: '7834512',
    taxiPermitNo: 'TP-88412',
  },
  segments: [
    {
      licenseNo: '24718',
      vehicle: { ...corolla, ours: true },
      monthlyRent: 6500,
      startDate: '2026-08-16',
      endDate: null,
    },
  ],
};

const sale: DealInput = {
  id: 'deal4',
  dealNo: 4,
  type: 'SALE',
  status: 'COMPLETED',
  date: '2026-11-03',
  price: 89_900,
  vatMode: 'MARGIN',
  payoutAmount: null,
  warrantyText: null,
  disclosureSignedAt: '2026-11-02T10:00:00.000Z',
  transferDueAt: '2026-11-11',
  sellerIsVatBusiness: false,
  isTradeIn: false,
  counterparty: {
    name: 'محمد حلبي',
    idNumber: '205873417',
    address: 'دالية الكرمل',
    phone: '0528876543',
  },
  vehicle: { ...mazda, dealerRegisteredAt: '2026-07-15' },
  payments: [
    { date: '2026-11-01', direction: 'IN', method: 'CASH', amount: 10_000, reference: null },
    { date: '2026-11-03', direction: 'IN', method: 'TRADE_IN', amount: 38_000, reference: null },
    {
      date: '2026-11-03',
      direction: 'IN',
      method: 'BANK_TRANSFER',
      amount: 30_000,
      reference: '77812',
    },
  ],
  tradeIn: {
    vehicle: { ...corolla, plateNo: '3268471', make: 'Hyundai', model: 'i20' },
    value: 38_000,
  },
  tradeInForDealNo: null,
  consignor: null,
  previousOwner: {
    name: 'יוסי כהן',
    idNumber: '037415962',
    address: null,
    phone: null,
    isCompany: false,
  },
};

const ledger = (over: Partial<LedgerReceiptInput> = {}): LedgerReceiptInput => ({
  id: 'cmw5mpia40000xdlkeklpwya6',
  type: 'DEPOSIT_IN',
  date: '2026-08-16',
  amount: 5000,
  method: null,
  reference: 'צ׳ק 0011223',
  description: null,
  rentPeriod: null,
  voided: false,
  driverId: 'd1',
  payer: lease.lessee,
  contract: { contractNo: 12, depositKind: 'CHECK' },
  licenseNo: '24718',
  plateNo: '31245625',
  ...over,
});

const consignment: ConsignmentInput = {
  id: 'cyc1',
  kind: 'CONSIGNED',
  startedAt: '2026-10-13',
  endedAt: null,
  agreementEndsAt: '2027-01-13',
  askingPrice: 132_000,
  minNetToConsignor: 120_000,
  commissionMode: 'PERCENT',
  commissionValue: 5,
  vehicleId: 'v9',
  owner: { name: 'سامر نصار', idNumber: '304129584', address: 'الناصرة', phone: '0549981122' },
  vehicle: { ...corolla, plateNo: '83920101', make: 'Toyota', model: 'RAV4' },
};

let engine: PdfTemplateEngine;
beforeAll(() => {
  engine = new PdfTemplateEngine();
});

/** Visible text of the rendered HTML (tags removed) for "is it printed" checks. */
function textOf(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

describe('lease contract', () => {
  it('model: parties, licence, car, rent, deposit, responsibilities, penalty, clauses', () => {
    const m = buildLeaseContract(lease, ctx());
    expect(m).toMatchObject({
      template: 'lease-contract',
      lang: 'he',
      dir: 'rtl',
      number: 'LC-000012',
      title: 'חוזה שכירות רכב מונית ורישיון מונית',
      documentTitle: 'חוזה שכירות רכב מונית ורישיון מונית LC-000012',
      owner: { key: 'contractId', id: 'lease1' },
      translated: false,
      business: { name: 'רינאוי מוטורס', dealerLicenseNo: '2026-0417' },
    });
    expect(m.data).toMatchObject({
      licenseNo: '24718',
      vehicle: { plateNo: '31245625', vin: 'JTNB23HE0P3012345' },
      monthlyRent: 6500,
      paymentDay: 10,
      deposit: { amount: 5000, kind: 'CHECK' },
      penaltyMonths: 1.5,
      penaltyAmount: 9750,
      signedOn: '2026-08-16',
      terms: 'משמרת לילה בלבד',
      clauses: { text: '1. סעיף כללי.', dir: 'rtl' },
    });
    expect(m.data.responsibilities).toEqual([
      { key: 'insurance', party: 'DRIVER' },
      { key: 'test', party: 'US' },
      { key: 'repairs', party: 'DRIVER' },
      { key: 'fines', party: 'DRIVER' },
    ]);
  });

  it('Arabic falls back to the Hebrew standard clauses; English is ltr', () => {
    expect(buildLeaseContract(lease, ctx('ar')).data.clauses).toEqual({
      text: '1. סעיף כללי.',
      dir: 'rtl',
    });
    const en = buildLeaseContract(lease, ctx('en'));
    expect(en).toMatchObject({ dir: 'ltr', translated: true, business: { name: 'Renawi Motors' } });
    expect(en.data.clauses).toEqual({ text: '1. General clause.', dir: 'ltr' });
  });

  it('html: key legal fields printed, plates and amounts isolated', () => {
    const html = engine.render(buildLeaseContract(lease, ctx()));
    expect(html).toContain('<html lang="he" dir="rtl">');
    const text = textOf(html);
    for (const s of [
      '031745284',
      '7834512',
      'TP-88412',
      '24718',
      '₪6,500.00',
      '₪5,000.00',
      '₪9,750.00',
      '16/08/2026',
      '15/08/2027',
      '2026-0417',
    ]) {
      expect(text).toContain(s);
    }
    expect(html).toContain('<bdi dir="ltr">312-45-625</bdi>');
    expect(html).toContain('<bdi dir="ltr">₪6,500.00</bdi>');
    expect(text).toContain('יחסי עובד ומעביד');
    expect(text).toContain('90 ימים');
  });

  it('number-only lease: the driver car is shown; no segment -> not applicable', () => {
    const numberOnly: LeaseInput = {
      ...lease,
      type: 'NUMBER_ONLY',
      segments: [
        {
          ...(lease.segments[0] as LeaseInput['segments'][number]),
          vehicle: { ...corolla, ours: false },
        },
      ],
    };
    expect(buildLeaseContract(numberOnly, ctx()).title).toBe('חוזה שכירות רישיון מונית');
    expect(() => buildLeaseContract({ ...lease, segments: [] }, ctx())).toThrow(
      PdfNotApplicableError,
    );
    expect(() => buildChecklist(numberOnly, 'handover', ctx())).toThrow(PdfNotApplicableError);
  });
});

describe('handover / return checklist', () => {
  it('handover: filled items, km, fuel; return without data is a blank form', () => {
    const h = buildChecklist(lease, 'handover', ctx());
    expect(h).toMatchObject({
      template: 'handover',
      number: 'HO-000012',
      owner: { key: 'contractId' },
    });
    expect(h.data).toMatchObject({
      filled: true,
      km: 112_350,
      fuelLevel: 'FULL',
      date: '2026-08-16',
    });
    expect(h.data.items.slice(0, 2)).toEqual([
      { key: 'photosTaken', checked: true },
      { key: 'spareWheel', checked: false },
    ]);
    const r = buildChecklist(lease, 'return', ctx('en'));
    expect(r).toMatchObject({ template: 'return', number: 'RT-000012' });
    expect(r.data.filled).toBe(false);
    expect(r.data.items.every((i) => i.checked === null)).toBe(true);
    expect(r.data.items.map((i) => i.key)).toContain('keysReturned');
    expect(() => buildChecklist({ ...lease, status: 'DRAFT' }, 'return', ctx())).toThrow(
      PdfNotApplicableError,
    );
    const text = textOf(engine.render(h));
    expect(text).toContain('112,350');
  });
});

describe('deposit receipt / payment confirmation', () => {
  it('deposit in: not a tax invoice, amount, deposit kind as the method', () => {
    const m = buildDepositReceipt(ledger(), ctx());
    expect(m).toMatchObject({
      template: 'deposit-receipt',
      title: 'אישור קבלת פיקדון',
      number: 'DR-20260816-LPWYA6',
      owner: { key: 'ledgerEntryId', id: 'cmw5mpia40000xdlkeklpwya6' },
    });
    expect(m.data).toMatchObject({
      kind: 'depositIn',
      amount: 5000,
      method: { enumName: 'DepositKind', value: 'CHECK' },
      contractNo: 12,
    });
    const text = textOf(engine.render(m));
    expect(text).toContain('אינו מהווה חשבונית מס/קבלה');
    expect(text).toContain('₪5,000.00');
    expect(text).toContain('031745284');
  });

  it('deposit out is a return confirmation; other types are not applicable', () => {
    expect(buildDepositReceipt(ledger({ type: 'DEPOSIT_OUT' }), ctx()).title).toBe(
      'אישור החזרת פיקדון',
    );
    expect(() => buildDepositReceipt(ledger({ type: 'PAYMENT' }), ctx())).toThrow(
      PdfNotApplicableError,
    );
    expect(() => buildDepositReceipt(ledger({ voided: true }), ctx())).toThrow(
      PdfNotApplicableError,
    );
    expect(() => buildLedgerPayment(ledger(), ctx())).toThrow(PdfNotApplicableError);
  });

  it('payments (ledger and deal) are titled "אישור תשלום"; the not-a-receipt line is in every language', () => {
    const p = buildLedgerPayment(
      ledger({ type: 'PAYMENT', method: 'BIT', rentPeriod: '2026-11' }),
      ctx(),
    );
    expect(p).toMatchObject({
      title: 'אישור תשלום',
      data: { kind: 'payment', method: { enumName: 'PaymentMethod', value: 'BIT' } },
    });
    const input: DealPaymentInput = {
      id: 'dp1',
      dealId: 'deal4',
      dealNo: 4,
      dealType: 'SALE',
      direction: 'IN',
      date: '2026-11-01',
      amount: 10_000,
      method: 'CASH',
      reference: null,
      notes: null,
      party: sale.counterparty,
      vehicle: { plateNo: '57466901', make: 'Mazda', model: '3', year: 2019 },
    };
    const dp = buildDealPayment(input, ctx('ar'));
    expect(dp).toMatchObject({
      owner: { key: 'dealId', id: 'deal4' },
      data: { kind: 'dealPaymentIn', dealNo: 4 },
    });
    const ar = textOf(engine.render(dp));
    expect(ar).toContain('אינו מהווה חשבונית מס/קבלה');
    expect(ar).toContain('ريناوي موتورز');
    expect(() => buildDealPayment({ ...input, method: 'TRADE_IN' }, ctx())).toThrow(
      PdfNotApplicableError,
    );
    expect(buildDealPayment({ ...input, direction: 'OUT' }, ctx()).data.kind).toBe(
      'dealPaymentOut',
    );
  });
});

describe('sale agreement', () => {
  it('model: dealer licence, buyer ID, vehicle, price, money payments only, trade-in, warranty, transfer date', () => {
    const m = buildSaleAgreement(sale, ctx());
    expect(m).toMatchObject({
      number: 'SA-000004',
      owner: { key: 'dealId', id: 'deal4' },
      business: { dealerLicenseNo: '2026-0417' },
    });
    expect(m.data).toMatchObject({
      buyer: { idNumber: '205873417' },
      vehicle: { hand: 3, km: 87_500, plateNo: '57466901' },
      price: 89_900,
      paid: 40_000,
      tradeInValue: 38_000,
      balance: 11_900,
      transferDueAt: '2026-11-11',
      disclosureSignedOn: '2026-11-02',
      warrantyIsDefault: true,
      depositCap: { applies: true, threshold: 59_610, percent: 20, maxAmount: 17_980 },
    });
    expect(m.data.payments.map((p) => p.method)).toEqual(['CASH', 'BANK_TRANSFER']);
    expect(m.data.warrantyText).toMatch(/[֐-׿]/);
  });

  it('html (he): dealer licence no., buyer ID, hand, km, price, 6 working days, Hebrew warranty', () => {
    const text = textOf(engine.render(buildSaleAgreement(sale, ctx())));
    for (const s of [
      '2026-0417',
      '205873417',
      '87,500',
      '₪89,900.00',
      '₪11,900.00',
      '11/11/2026',
      '6 ימי עבודה',
      'סעיף 86',
      '₪38,000.00',
    ]) {
      expect(text).toContain(s);
    }
  });

  it('html (en): the warranty stays Hebrew, with a translation line', () => {
    const html = engine.render(
      buildSaleAgreement({ ...sale, warrantyText: 'אחריות למנוע ל-3 חודשים' }, ctx('en')),
    );
    expect(html).toContain(
      '<div class="hebrew-block" dir="rtl" lang="he">אחריות למנוע ל-3 חודשים</div>',
    );
    expect(textOf(html)).toContain('the Hebrew text above is the binding text');
  });

  it('consignment sale names the registered owner; purchases are not sales', () => {
    const consigned: DealInput = {
      ...sale,
      type: 'CONSIGNMENT_SALE',
      consignor: consignment.owner,
      tradeIn: null,
      payments: [],
    };
    const m = buildSaleAgreement(consigned, ctx());
    expect(m.title).toBe('הסכם מכירת רכב משומש בתיווך');
    expect(textOf(engine.render(m))).toContain('304129584');
    expect(() => buildSaleAgreement({ ...sale, type: 'PURCHASE' }, ctx())).toThrow(
      PdfNotApplicableError,
    );
    expect(() => buildSaleAgreement({ ...sale, status: 'CANCELLED' }, ctx())).toThrow(
      PdfNotApplicableError,
    );
  });
});

describe('purchase agreement', () => {
  it('seller declarations, price, OUT payments, VAT business wording', () => {
    const purchase: DealInput = {
      ...sale,
      type: 'PURCHASE',
      price: 50_000,
      sellerIsVatBusiness: true,
      counterparty: {
        name: 'צפון ליסינג בע״מ',
        idNumber: '514772035',
        address: 'חיפה',
        phone: '048555900',
        isCompany: true,
      },
      payments: [
        {
          date: '2026-07-15',
          direction: 'OUT',
          method: 'BANK_TRANSFER',
          amount: 50_000,
          reference: 'TR-1',
        },
      ],
      tradeIn: null,
    };
    const m = buildPurchaseAgreement(purchase, ctx());
    expect(m).toMatchObject({
      number: 'PA-000004',
      data: { price: 50_000, paid: 50_000, balance: 0, sellerIsVatBusiness: true },
    });
    const text = textOf(engine.render(m));
    for (const s of ['514772035', '₪50,000.00', '87,500', 'שעבוד', 'חשבונית מס'])
      expect(text).toContain(s);
    expect(() => buildPurchaseAgreement(sale, ctx())).toThrow(PdfNotApplicableError);
  });
});

describe('disclosure form', () => {
  it('dealer identity + status, registered owner, hands, previous owner, km, price, buyer', () => {
    const m = buildDisclosure(sale, ctx());
    expect(m).toMatchObject({ template: 'disclosure-form', number: 'DF-000004' });
    expect(m.data).toMatchObject({
      consignment: false,
      registeredOwner: { name: 'רינאוי מוטורס', idNumber: '516427184', isDealer: true },
      previousOwner: { name: 'יוסי כהן' },
      hands: 3,
      km: 87_500,
      price: 89_900,
      signedOn: '2026-11-02',
      history: { taxi: null },
    });
    const text = textOf(engine.render(m));
    for (const s of [
      '2026-0417',
      '516427184',
      '205873417',
      '87,500',
      '₪89,900.00',
      'סוחר רכב בעל רישיון',
      'יוסי כהן',
    ]) {
      expect(text).toContain(s);
    }
  });

  it('consignment: the consignor is the registered owner; taxi history is ticked; purchases are refused', () => {
    const m = buildDisclosure(
      {
        ...sale,
        type: 'CONSIGNMENT_SALE',
        consignor: consignment.owner,
        vehicle: { ...sale.vehicle, isTaxi: true },
      },
      ctx(),
    );
    expect(m.data.registeredOwner).toMatchObject({ name: 'سامر نصار', isDealer: false });
    expect(m.data.history.taxi).toBe(true);
    expect(textOf(engine.render(m))).toContain('המוכר את הרכב בתיווך');
    expect(() => buildDisclosure({ ...sale, type: 'PURCHASE' }, ctx())).toThrow(
      PdfNotApplicableError,
    );
  });
});

describe('consignment agreement', () => {
  it('owner, asking price, minimum net, percent commission, period; OWNED cycles refused', () => {
    const m = buildConsignment(consignment, ctx());
    expect(m).toMatchObject({
      template: 'consignment-agreement',
      owner: { key: 'vehicleId', id: 'v9' },
      data: {
        askingPrice: 132_000,
        minNet: 120_000,
        commissionMode: 'PERCENT',
        commissionValue: 5,
      },
    });
    const html = engine.render(m);
    const text = textOf(html);
    for (const s of ['304129584', '₪132,000.00', '₪120,000.00', '13/10/2026', '13/01/2027'])
      expect(text).toContain(s);
    expect(html).toContain('<bdi dir="ltr">5%</bdi>');
    expect(() => buildConsignment({ ...consignment, kind: 'OWNED' }, ctx())).toThrow(
      PdfNotApplicableError,
    );
  });
});

describe('footer', () => {
  it('page x of y, document number and date, Rubik embedded', () => {
    const footer = engine.footer(buildSaleAgreement(sale, ctx('ar')));
    expect(footer).toContain('class="pageNumber"');
    expect(footer).toContain('class="totalPages"');
    expect(footer).toContain('SA-000004');
    expect(footer).toContain('dir="rtl"');
    expect(footer).toContain('صفحة');
    expect(footer).toMatch(/@font-face\{font-family:'Rubik'/);
  });
});
