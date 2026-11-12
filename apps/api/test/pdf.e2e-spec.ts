import { BUSINESS_NAME, formatPlate, type Locale } from '@renawi/shared';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { Factory, LeaseBody, LedgerEntryBody, Ref } from './factories';
import {
  binaryParser,
  daysFromToday,
  expectError,
  israeliId,
  Session,
  startSession,
  today,
} from './helpers';

// Rendering goes through a real Chromium: give these tests room.
jest.setTimeout(180_000);

interface DocumentBody {
  id: string;
  kind: string;
  title: string | null;
  lang: string | null;
  mime: string;
  size: number;
  fileName: string;
  url: string;
  contractId: string | null;
  dealId: string | null;
  ledgerEntryId: string | null;
  vehicleId: string | null;
}

interface Case {
  template: string;
  id: () => string;
  kind: string;
  owner: () => [keyof DocumentBody, string];
  /** Plate printed in the document (isolated as LTR). */
  plate: (() => string) | null;
  /** The document prints amounts (handover / return checklists do not). */
  money?: false;
}

const LANGS: Locale[] = ['he', 'ar', 'en'];

describe('PDF generation (e2e)', () => {
  let s: Session;
  let f: Factory;
  let lease: LeaseBody;
  let numberOnly: LeaseBody;
  let depositEntryId: string;
  let paymentEntryId: string;
  let purchaseId: string;
  let purchaseCycleId: string;
  let saleId: string;
  let salePlate: string;
  let dealPaymentId: string;
  let consignedVehicleId: string;
  let consignedPlate: string;
  let cycleId: string;

  function ok<T>(res: { status: number; body: unknown }, status = 201): T {
    expect({ status: res.status, body: res.status === status ? 'ok' : res.body }).toEqual({
      status,
      body: 'ok',
    });
    return res.body as T;
  }

  const leasePlate = () => lease.currentSegment?.vehicle?.plateNo as string;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 14);
    ok(
      await s.api.patch('/api/settings').send({
        legalId: israeliId('51642718'),
        dealerLicenseNo: '2026-0417',
        address: 'רח׳ פאולוס השישי 45, נצרת',
        phone: '046001234',
      }),
      200,
    );

    // Lease (car + number) for an Arabic-speaking driver, with a deposit and a handover checklist.
    const driver = await f.driver({
      contact: {
        firstName: 'خالد',
        lastName: 'عودة',
        idNumber: israeliId('03174528'),
        phones: ['0527345611'],
        address: 'حي الصفافرة 12',
        city: 'الناصرة',
        preferredLang: 'ar',
      },
      licenseNo: '7834512',
      taxiPermitNo: 'TP-88412',
    });
    const draft = await f.draft({
      driverId: driver.id,
      startDate: daysFromToday(-20),
      monthlyRent: 6500,
      depositAmount: 5000,
      depositKind: 'CHECK',
      terms: 'משמרת לילה בלבד',
    });
    lease = await f.activate(draft.id, {
      deposit: { amount: 5000, kind: 'CHECK', reference: 'צ׳ק 0042' },
      handoverChecklist: { photosTaken: true, km: 54_321, fuelLevel: 'FULL', spareWheel: true },
    });
    const entries = (await f.ledger(driver.id)).items;
    depositEntryId = (entries.find((e) => e.type === 'DEPOSIT_IN') as LedgerEntryBody).id;
    const payment = ok<LedgerEntryBody>(
      await s.api.post('/api/ledger/payments').send({
        driverId: driver.id,
        contractId: lease.id,
        date: today(),
        amount: 1000,
        method: 'BIT',
        reference: 'BIT-5521',
      }),
    );
    paymentEntryId = payment.id;
    numberOnly = await f.activeLease({ type: 'NUMBER_ONLY' });

    // Purchase -> sale with a cash payment and a signed disclosure.
    const seller = ok<Ref>(
      await s.api.post('/api/contacts').send({
        firstName: 'יוסי',
        lastName: 'כהן',
        idNumber: israeliId('03741596'),
        phones: ['0541239876'],
      }),
    );
    const buyer = ok<Ref>(
      await s.api.post('/api/contacts').send({
        firstName: 'רונית',
        lastName: 'לוי',
        idNumber: israeliId('02995314'),
        phones: ['0507712345'],
        preferredLang: 'he',
      }),
    );
    salePlate = f.nextPlate();
    const purchase = ok<Ref & { vehicleId: string; cycleId: string }>(
      await s.api.post('/api/deals').send({
        type: 'PURCHASE',
        vehicle: {
          create: {
            plateNo: salePlate,
            make: 'Mazda',
            model: '3',
            year: 2019,
            hand: 3,
            currentKm: 87_500,
          },
        },
        counterpartyId: seller.id,
        date: daysFromToday(-30),
        price: 50_000,
      }),
    );
    purchaseId = purchase.id;
    purchaseCycleId = purchase.cycleId;
    ok(await s.api.post(`/api/deals/${purchaseId}/complete`).send({}), 200);
    const sale = ok<Ref & { payments: { id: string }[] }>(
      await s.api.post('/api/deals').send({
        type: 'SALE',
        vehicleId: purchase.vehicleId,
        counterpartyId: buyer.id,
        date: today(),
        price: 89_900,
        warrantyText: 'אחריות למנוע ולתיבת ההילוכים ל-3 חודשים או 5,000 ק״מ',
      }),
    );
    saleId = sale.id;
    const paid = ok<{ payments: { id: string; method: string }[] }>(
      await s.api
        .post(`/api/deals/${saleId}/payments`)
        .send({ direction: 'IN', date: today(), method: 'CASH', amount: 10_000 }),
    );
    dealPaymentId = (paid.payments.find((p) => p.method === 'CASH') as { id: string }).id;
    ok(
      await s.api
        .post(`/api/deals/${saleId}/disclosure`)
        .send({ signedAt: new Date().toISOString() }),
      200,
    );

    // Consignment intake.
    const consignor = ok<Ref>(
      await s.api.post('/api/contacts').send({
        firstName: 'سامر',
        lastName: 'نصار',
        idNumber: israeliId('30412958'),
        preferredLang: 'ar',
      }),
    );
    consignedPlate = f.nextPlate();
    const consigned = ok<Ref>(
      await s.api.post('/api/vehicles').send({
        plateNo: consignedPlate,
        make: 'Toyota',
        model: 'RAV4',
        year: 2020,
        status: 'EXTERNAL',
      }),
    );
    consignedVehicleId = consigned.id;
    const intake = ok<{ openCycle: { id: string } }>(
      await s.api.post(`/api/vehicles/${consigned.id}/consign`).send({
        consignorId: consignor.id,
        askingPrice: 132_000,
        minNetToConsignor: 120_000,
        commissionMode: 'PERCENT',
        commissionValue: 5,
        agreementEndsAt: daysFromToday(90),
      }),
      200,
    );
    cycleId = intake.openCycle.id;
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  const CASES: Case[] = [
    {
      template: 'lease-contract',
      id: () => lease.id,
      kind: 'CONTRACT',
      owner: () => ['contractId', lease.id],
      plate: leasePlate,
    },
    {
      template: 'handover',
      id: () => lease.id,
      kind: 'HANDOVER',
      owner: () => ['contractId', lease.id],
      plate: leasePlate,
      money: false,
    },
    {
      template: 'return',
      id: () => lease.id,
      kind: 'HANDOVER',
      owner: () => ['contractId', lease.id],
      plate: leasePlate,
      money: false,
    },
    {
      template: 'deposit-receipt',
      id: () => depositEntryId,
      kind: 'RECEIPT',
      owner: () => ['ledgerEntryId', depositEntryId],
      plate: null,
    },
    {
      template: 'payment-confirmation',
      id: () => paymentEntryId,
      kind: 'RECEIPT',
      owner: () => ['ledgerEntryId', paymentEntryId],
      plate: null,
    },
    {
      template: 'sale-agreement',
      id: () => saleId,
      kind: 'AGREEMENT',
      owner: () => ['dealId', saleId],
      plate: () => salePlate,
    },
    {
      template: 'purchase-agreement',
      id: () => purchaseId,
      kind: 'AGREEMENT',
      owner: () => ['dealId', purchaseId],
      plate: () => salePlate,
    },
    {
      template: 'consignment-agreement',
      id: () => cycleId,
      kind: 'AGREEMENT',
      owner: () => ['vehicleId', consignedVehicleId],
      plate: () => consignedPlate,
    },
    {
      template: 'disclosure-form',
      id: () => saleId,
      kind: 'DISCLOSURE_FORM',
      owner: () => ['dealId', saleId],
      plate: () => salePlate,
    },
  ];

  const matrix = CASES.flatMap((c) => LANGS.map((lang) => [c.template, lang, c] as const));

  async function download(url: string): Promise<Buffer> {
    const res = await s.api.get(url).buffer(true).parse(binaryParser);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    return res.body as Buffer;
  }

  async function expectPdf(bytes: Buffer): Promise<number> {
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5 * 1024);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    return pdf.getPageCount();
  }

  it('requires authentication', async () => {
    expect(
      (await request(s.t.http).get(`/api/pdf/lease-contract/${lease.id}/preview`)).status,
    ).toBe(401);
  });

  describe.each(matrix)('%s (%s)', (template, lang, c) => {
    it('preview: dir, business name in the language, isolated plate and amounts', async () => {
      const res = await s.api.get(`/api/pdf/${template}/${c.id()}/preview?lang=${lang}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      const html = res.text;
      expect(html).toContain(`<html lang="${lang}" dir="${lang === 'en' ? 'ltr' : 'rtl'}">`);
      expect(html).toContain(BUSINESS_NAME[lang]);
      if (c.money !== false) expect(html).toMatch(/<bdi dir="ltr">₪[\d,]+\.\d{2}<\/bdi>/);
      if (c.plate) expect(html).toContain(`<bdi dir="ltr">${formatPlate(c.plate())}</bdi>`);
      expect(html).toContain('@font-face');
      if (lang !== 'he') expect(html).toContain('class="notice"');
    });

    it('POST stores a Document (kind, owner, lang) whose file is a PDF', async () => {
      const doc = ok<DocumentBody>(await s.api.post(`/api/pdf/${template}/${c.id()}?lang=${lang}`));
      const [ownerKey, ownerId] = c.owner();
      expect(doc).toMatchObject({
        kind: c.kind,
        lang,
        mime: 'application/pdf',
        [ownerKey]: ownerId,
      });
      expect(doc.title).toEqual(expect.any(String));
      expect(doc.fileName).toMatch(new RegExp(`^${template}-.*-${lang}\\.pdf$`));
      expect(doc.url).toBe(`/api/documents/${doc.id}/file`);
      const bytes = await download(doc.url);
      expect(bytes.length).toBe(doc.size);
      await expectPdf(bytes);
    });
  });

  it('payment confirmation of a deal payment hangs on the deal', async () => {
    const doc = ok<DocumentBody>(
      await s.api.post(`/api/pdf/payment-confirmation/${dealPaymentId}`),
    );
    expect(doc).toMatchObject({ kind: 'RECEIPT', dealId: saleId, lang: 'he' });
    await expectPdf(await download(doc.url));
    const html = (await s.api.get(`/api/pdf/payment-confirmation/${dealPaymentId}/preview`)).text;
    expect(html).toContain('אינו מהווה חשבונית מס/קבלה');
    expect(html).toContain('<bdi dir="ltr">₪10,000.00</bdi>');
  });

  it('default language: the counterparty preferred language (lease driver: Arabic)', async () => {
    const doc = ok<DocumentBody>(await s.api.post(`/api/pdf/lease-contract/${lease.id}`));
    expect(doc.lang).toBe('ar');
    const html = (await s.api.get(`/api/pdf/disclosure-form/${saleId}/preview`)).text;
    expect(html).toContain('<html lang="he" dir="rtl">');
  });

  it('key legal content is printed', async () => {
    const sale = (await s.api.get(`/api/pdf/sale-agreement/${saleId}/preview?lang=he`)).text;
    expect(sale).toContain('2026-0417');
    expect(sale).toContain(israeliId('02995314'));
    expect(sale).toContain('<bdi dir="ltr">₪89,900.00</bdi>');
    expect(sale).toContain('6 ימי עבודה');
    expect(sale).toContain('אחריות למנוע ולתיבת ההילוכים');
    const en = (await s.api.get(`/api/pdf/sale-agreement/${saleId}/preview?lang=en`)).text;
    expect(en).toContain('dir="rtl" lang="he">אחריות למנוע ולתיבת ההילוכים');
    const disclosure = (await s.api.get(`/api/pdf/disclosure-form/${saleId}/preview?lang=he`)).text;
    expect(disclosure).toContain('<bdi dir="ltr">3</bdi>');
    expect(disclosure).toContain('<bdi dir="ltr">87,500</bdi>');
    expect(disclosure).toContain('יוסי כהן');
    const lease1 = (await s.api.get(`/api/pdf/lease-contract/${lease.id}/preview?lang=ar`)).text;
    expect(lease1).toContain('خالد عودة');
    expect(lease1).toContain('<bdi dir="ltr">TP-88412</bdi>');
    expect(lease1).toContain('<bdi dir="ltr">₪5,000.00</bdi>');
    expect(lease1).toContain('علاقة العمل');
    const receipt = (await s.api.get(`/api/pdf/deposit-receipt/${depositEntryId}/preview?lang=he`))
      .text;
    expect(receipt).toContain('אישור קבלת פיקדון');
    expect(receipt).toContain('אינו מהווה חשבונית מס/קבלה');
  });

  it('409 errors.pdfNotApplicable when the template does not fit the entity', async () => {
    for (const url of [
      `/api/pdf/disclosure-form/${purchaseId}`,
      `/api/pdf/sale-agreement/${purchaseId}`,
      `/api/pdf/purchase-agreement/${saleId}`,
      `/api/pdf/handover/${numberOnly.id}`,
      `/api/pdf/deposit-receipt/${paymentEntryId}`,
      `/api/pdf/payment-confirmation/${depositEntryId}`,
      `/api/pdf/consignment-agreement/${purchaseCycleId}`,
    ]) {
      expectError(await s.api.post(url), 409, 'errors.pdfNotApplicable');
      expectError(await s.api.get(`${url}/preview`), 409, 'errors.pdfNotApplicable');
    }
  });

  it('404 for an unknown template or entity; 400 for an unknown language', async () => {
    expectError(await s.api.post(`/api/pdf/invoice/${saleId}`), 404, 'errors.notFound');
    expectError(await s.api.post('/api/pdf/sale-agreement/missing'), 404, 'errors.notFound');
    expectError(
      await s.api.get('/api/pdf/payment-confirmation/missing/preview'),
      404,
      'errors.notFound',
    );
    const bad = await s.api.get(`/api/pdf/sale-agreement/${saleId}/preview?lang=fr`);
    expect(bad.status).toBe(400);
  });

  it('regenerating creates new Documents; 5 parallel renders all succeed', async () => {
    const before = (await s.api.get(`/api/documents?dealId=${saleId}`)).body as DocumentBody[];
    const results = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        s.api.post(
          `/api/pdf/${i % 2 ? 'disclosure-form' : 'sale-agreement'}/${saleId}?lang=${LANGS[i % 3]}`,
        ),
      ),
    );
    for (const res of results) expect(res.status).toBe(201);
    const ids = new Set(results.map((r) => (r.body as DocumentBody).id));
    expect(ids.size).toBe(5);
    for (const res of results) await expectPdf(await download((res.body as DocumentBody).url));
    const after = (await s.api.get(`/api/documents?dealId=${saleId}`)).body as DocumentBody[];
    expect(after.length).toBe(before.length + 5);
  });
});
