import { formatPlate, sumMoney, vatOnMargin } from '@renawi/shared';
import { Factory, type Ref } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

/* Wire shapes used by the assertions. */
interface PlateHistoryBody {
  id: string;
  oldPlateNo: string;
  newPlateNo: string;
  changedAt: string;
  reason: string;
  conversionTax: number | null;
  expenseId: string | null;
  notes: string | null;
}
interface VehicleBody {
  id: string;
  plateNo: string;
  isTaxi: boolean;
  status: string;
  listingPrice: number | null;
  expectedConversionTax: number | null;
  convertedAt: string | null;
  meterSerial: string | null;
  meterSealedAt: string | null;
  formerTaxi: boolean;
  formerTaxiPlateNo: string | null;
  privatePriceEstimate: number | null;
  openCycle: { id: string; startedAt: string } | null;
  alerts: string[];
  plateHistory: PlateHistoryBody[];
  canConvert: { allowed: boolean; blockers: string[] };
  expenseSummary: { byCategory: { category: string; total: number }[] };
  [key: string]: unknown;
}
interface ExpenseBody {
  id: string;
  category: string;
  amount: number;
  date: string;
  paidBy: string;
  vatIncluded: boolean;
  vatReclaimable: boolean;
  cycleId: string | null;
  description: string | null;
  vendor: { id: string; name: string } | null;
}
interface DealBody {
  id: string;
  cycleId: string | null;
  vehicleId: string;
  vehicle: { id: string; plateNo: string; formerTaxiPlateNo: string | null };
  transferChecklist: Record<string, unknown>;
  vat: { mode: string; base: number; amount: number };
}
interface CostsBody {
  purchase: number;
  expenses: number;
  conversionTax: number;
  vatOnMargin: number;
  total: number;
}
interface ReportBody {
  columns: { key: string; type: string }[];
  rows: Record<string, unknown>[];
}

describe('Taxi -> private conversion (e2e)', () => {
  let s: Session;
  let f: Factory;
  let privateSeq = 52_000_000;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 31);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  function ok<T>(res: { status: number; body: unknown }, status = 200): T {
    expect({ status: res.status, body: res.status === status ? 'ok' : res.body }).toEqual({
      status,
      body: 'ok',
    });
    return res.body as T;
  }

  /** A fresh private 8-digit plate (always ends in 11: never a 25 / 26 taxi plate). */
  function privatePlate(): string {
    privateSeq += 100;
    return String(privateSeq + 11);
  }

  /** A private car with a private plate (target of the duplicate checks). */
  async function privateCar(): Promise<Ref & { plateNo: string }> {
    return f.taxi({ isTaxi: false, plateNo: privatePlate() });
  }

  const convertUrl = (id: string) => `/api/vehicles/${id}/convert-to-private`;
  const correctUrl = (id: string) => `/api/vehicles/${id}/conversion`;

  async function vehicle(id: string): Promise<VehicleBody> {
    return ok(await s.api.get(`/api/vehicles/${id}`));
  }

  async function expenses(id: string): Promise<ExpenseBody[]> {
    return ok<{ items: ExpenseBody[] }>(await s.api.get(`/api/vehicles/${id}/expenses`)).items;
  }

  async function convert(id: string, body: Record<string, unknown> = {}): Promise<VehicleBody> {
    return ok(
      await s.api.post(convertUrl(id)).send({
        convertedAt: today(),
        newPlateNo: privatePlate(),
        conversionTax: 15_000,
        ...body,
      }),
    );
  }

  async function contact(body: Record<string, unknown>): Promise<Ref> {
    return ok(await s.api.post('/api/contacts').send(body), 201);
  }

  async function listIds(query: string): Promise<string[]> {
    const res = ok<{ items: { id: string }[] }>(await s.api.get(`/api/vehicles?${query}`));
    return res.items.map((v) => v.id);
  }

  async function pnlCosts(id: string): Promise<CostsBody> {
    const pnl = ok<{ cycles: { costs: CostsBody }[] }>(await s.api.get(`/api/vehicles/${id}/pnl`));
    return (pnl.cycles[0] as { costs: CostsBody }).costs;
  }

  /* ------------------------------------------------------------------------------------ */
  /* Happy path: the owner's example (bought as a taxi for 30,000, customs 15,000)        */
  /* ------------------------------------------------------------------------------------ */

  describe('convert-to-private', () => {
    const TAXI_PLATE = '8473126';
    const NEW_PLATE = '12345678';
    let taxiId: string;
    let cycleId: string;
    let purchaseId: string;
    let saleId: string;
    let customsId: string;

    beforeAll(async () => {
      const seller = await contact({ firstName: 'יוסי', lastName: 'כהן' });
      const buyer = await contact({ firstName: 'רונית', lastName: 'לוי' });
      customsId = (await contact({ companyName: 'רשות המסים — מכס', tags: ['SUPPLIER'] })).id;
      // Bought as a taxi 30 days ago (price as taxi 35,000, expected customs 15,000).
      const bought = ok<DealBody>(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: {
            create: {
              plateNo: '84-731-26',
              make: 'Skoda',
              model: 'Octavia',
              year: 2018,
              isTaxi: true,
              listingPrice: 35_000,
              expectedConversionTax: 15_000,
              meterSerial: 'MT-2018-1',
              meterSealedAt: daysFromToday(-40),
            },
          },
          counterpartyId: seller.id,
          date: daysFromToday(-30),
          price: 30_000,
        }),
        201,
      );
      taxiId = bought.vehicleId;
      cycleId = bought.cycleId as string;
      purchaseId = bought.id;
      // A draft sale reserves the car: a RESERVED taxi can still be converted.
      saleId = ok<DealBody>(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId: taxiId,
          counterpartyId: buyer.id,
          date: today(),
          price: 50_000,
        }),
        201,
      ).id;
    });

    it('before: the taxi shows its private price estimate and may be converted', async () => {
      const v = await vehicle(taxiId);
      expect(v).toMatchObject({
        plateNo: TAXI_PLATE,
        isTaxi: true,
        status: 'RESERVED',
        listingPrice: 35_000,
        expectedConversionTax: 15_000,
        privatePriceEstimate: 50_000,
        convertedAt: null,
        formerTaxi: false,
        formerTaxiPlateNo: null,
        plateHistory: [],
        canConvert: { allowed: true, blockers: [] },
      });
      const sale = ok<DealBody>(await s.api.get(`/api/deals/${saleId}`));
      expect(sale.transferChecklist).toHaveProperty('taxiLicenseDetached', false);
    });

    it('swaps the plate, stops being a taxi, records the history and the customs expense', async () => {
      const v = await convert(taxiId, {
        newPlateNo: '123-45-678',
        vendorId: customsId,
        notes: 'הסבה במכס חיפה',
      });
      expect(v).toMatchObject({
        id: taxiId,
        plateNo: NEW_PLATE,
        isTaxi: false,
        status: 'RESERVED',
        convertedAt: today(),
        formerTaxi: true,
        formerTaxiPlateNo: TAXI_PLATE,
        meterSerial: null,
        meterSealedAt: null,
        expectedConversionTax: null,
        // 35,000 as a taxi + 15,000 customs.
        listingPrice: 50_000,
        privatePriceEstimate: null,
        canConvert: { allowed: false, blockers: ['errors.vehicleNotTaxi'] },
      });
      expect(v.plateHistory).toEqual([
        {
          id: expect.any(String),
          oldPlateNo: TAXI_PLATE,
          newPlateNo: NEW_PLATE,
          changedAt: today(),
          reason: 'TAXI_TO_PRIVATE',
          conversionTax: 15_000,
          expenseId: expect.any(String),
          notes: 'הסבה במכס חיפה',
        },
      ]);
      const [expense] = await expenses(taxiId);
      expect(expense).toMatchObject({
        id: v.plateHistory[0]?.expenseId,
        category: 'CONVERSION_TAX',
        amount: 15_000,
        date: today(),
        paidBy: 'US',
        vatIncluded: false,
        vatReclaimable: false,
        cycleId,
        vendor: { id: customsId },
        description: 'Taxi to private conversion, 84-731-26 → 123-45-678',
      });
      expect(v.expenseSummary.byCategory).toContainEqual({
        category: 'CONVERSION_TAX',
        total: 15_000,
      });

      const audit = await s.t.prisma.auditLog.findFirst({
        where: { entity: 'Vehicle', entityId: taxiId, action: 'UPDATE' },
        orderBy: { at: 'desc' },
      });
      const changes = (audit?.diff as { changes: Record<string, { from: unknown; to: unknown }> })
        .changes;
      expect(changes.plateNo).toEqual({ from: TAXI_PLATE, to: NEW_PLATE });
      expect(changes.isTaxi).toEqual({ from: true, to: false });
      expect(String(changes.summary?.to)).toBe('Converted taxi to private: 84-731-26 → 123-45-678');
    });

    it('cannot be converted twice', async () => {
      expectError(
        await s.api
          .post(convertUrl(taxiId))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 1 }),
        409,
        'errors.vehicleNotTaxi',
      );
    });

    it('finds the car by its old and its new plate (vehicles and deals); formerTaxi filter', async () => {
      expect(await listIds('q=84-731-26')).toEqual([taxiId]);
      expect(await listIds('q=7312')).toContain(taxiId);
      expect(await listIds(`q=${NEW_PLATE}`)).toEqual([taxiId]);
      const listed = ok<{ items: VehicleBody[] }>(await s.api.get('/api/vehicles?q=8473126'))
        .items[0];
      expect(listed).toMatchObject({
        formerTaxi: true,
        formerTaxiPlateNo: TAXI_PLATE,
        expectedConversionTax: null,
        privatePriceEstimate: null,
      });
      expect(await listIds('formerTaxi=true')).toEqual([taxiId]);
      expect(await listIds('formerTaxi=false')).not.toContain(taxiId);

      // The purchase (as a taxi) and the sale of the car.
      const deals = ok<{ items: DealBody[] }>(await s.api.get('/api/deals?q=84-731-26')).items;
      expect(deals.map((d) => d.id).sort()).toEqual([purchaseId, saleId].sort());
      expect(deals[0]?.vehicle).toMatchObject({
        plateNo: NEW_PLATE,
        formerTaxiPlateNo: TAXI_PLATE,
      });
    });

    it('the deal transfer checklist no longer asks for the taxi licence to be detached', async () => {
      const sale = ok<DealBody>(await s.api.get(`/api/deals/${saleId}`));
      expect(sale.transferChecklist).not.toHaveProperty('taxiLicenseDetached');
    });

    it('P&L: the customs are their own cost line; the VAT margin base follows the setting', async () => {
      const off = vatOnMargin(50_000, 30_000, 18);
      expect(await pnlCosts(taxiId)).toEqual({
        purchase: 30_000,
        expenses: 0,
        conversionTax: 15_000,
        vatOnMargin: off,
        total: sumMoney([30_000, 15_000, off]),
      });
      let sale = ok<DealBody>(await s.api.get(`/api/deals/${saleId}`));
      expect(sale.vat).toMatchObject({ mode: 'MARGIN', base: 20_000, amount: off });

      const settings = ok<{ vatMarginIncludesConversionTax: boolean }>(
        await s.api.patch('/api/settings').send({ vatMarginIncludesConversionTax: true }),
      );
      expect(settings.vatMarginIncludesConversionTax).toBe(true);
      const on = vatOnMargin(50_000, 45_000, 18);
      expect((await pnlCosts(taxiId)).vatOnMargin).toBe(on);
      sale = ok<DealBody>(await s.api.get(`/api/deals/${saleId}`));
      expect(sale.vat).toMatchObject({ mode: 'MARGIN', base: 5000, amount: on });

      ok(await s.api.patch('/api/settings').send({ vatMarginIncludesConversionTax: false }));
      expect(
        ok<{ vatMarginIncludesConversionTax: boolean }>(await s.api.get('/api/settings'))
          .vatMarginIncludesConversionTax,
      ).toBe(false);
    });

    it('reports: trade book and inventory ageing carry the former taxi plate and the customs', async () => {
      const book = ok<ReportBody>(
        await s.api.get(`/api/reports/trade-book?from=${daysFromToday(-60)}&to=${today()}`),
      );
      expect(book.columns).toContainEqual({
        key: 'formerTaxiPlateNo',
        label: 'reports.columns.formerTaxiPlateNo',
        type: 'plate',
      });
      expect(book.columns).toContainEqual({
        key: 'conversionTax',
        label: 'reports.columns.conversionTax',
        type: 'money',
      });
      expect(book.rows.find((r) => r.plateNo === NEW_PLATE)).toMatchObject({
        formerTaxiPlateNo: TAXI_PLATE,
        purchasePrice: 30_000,
        repairsTotal: 0,
        conversionTax: 15_000,
      });

      const ageing = ok<ReportBody>(await s.api.get('/api/reports/inventory-ageing'));
      expect(ageing.columns.map((c) => c.key)).toContain('formerTaxiPlateNo');
      expect(ageing.rows.find((r) => r.plateNo === NEW_PLATE)).toMatchObject({
        formerTaxiPlateNo: TAXI_PLATE,
        purchasePrice: 30_000,
        expenses: 15_000,
        totalCost: 45_000,
      });
    });

    it('disclosure form and sale agreement show the car was a taxi and its former plate', async () => {
      const disclosure = (await s.api.get(`/api/pdf/disclosure-form/${saleId}/preview?lang=he`))
        .text;
      expect(disclosure).toContain('הרכב שימש כמונית');
      expect(disclosure).toContain('מספר רישוי קודם (מונית)');
      expect(disclosure).toContain('84-731-26');
      expect(disclosure).toContain('123-45-678');
      const agreement = (await s.api.get(`/api/pdf/sale-agreement/${saleId}/preview?lang=en`)).text;
      expect(agreement).toContain('Previous registration (plate) No. (taxi)');
      expect(agreement).toContain('84-731-26');
    });

    it('isTaxi cannot be set back; the expected customs only exist on taxis', async () => {
      expectError(
        await s.api.patch(`/api/vehicles/${taxiId}`).send({ isTaxi: true }),
        409,
        'errors.invalidTransition',
      );
      const v = ok<VehicleBody>(
        await s.api.patch(`/api/vehicles/${taxiId}`).send({ expectedConversionTax: 9000 }),
      );
      expect(v).toMatchObject({ isTaxi: false, expectedConversionTax: null });
      const created = ok<VehicleBody>(
        await s.api.post('/api/vehicles').send({
          plateNo: f.nextPlate(),
          make: 'Kia',
          model: 'Picanto',
          year: 2020,
          expectedConversionTax: 5000,
        }),
        201,
      );
      expect(created.expectedConversionTax).toBeNull();
    });

    it('the old plate is retired: no vehicle may take it (create, edit, purchase)', async () => {
      const duplicate = [{ path: 'plateNo', message: 'validation.duplicate' }];
      expectError(
        await s.api
          .post('/api/vehicles')
          .send({ plateNo: '84-731-26', make: 'Kia', model: 'Rio', year: 2020 }),
        409,
        'errors.conflict',
        duplicate,
      );
      const other = await f.taxi();
      expectError(
        await s.api.patch(`/api/vehicles/${other.id}`).send({ plateNo: TAXI_PLATE }),
        409,
        'errors.conflict',
        duplicate,
      );
      const seller = await contact({ firstName: 'דן', lastName: 'בדיקה' });
      expectError(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: { create: { plateNo: TAXI_PLATE, make: 'Kia', model: 'Rio', year: 2020 } },
          counterpartyId: seller.id,
          date: today(),
          price: 10_000,
        }),
        409,
        'errors.conflict',
        [{ path: 'vehicle.create.plateNo', message: 'validation.duplicate' }],
      );
    });
  });

  /* ------------------------------------------------------------------------------------ */
  /* Rules                                                                                */
  /* ------------------------------------------------------------------------------------ */

  describe('rules', () => {
    it('404 for an unknown vehicle', async () => {
      expectError(
        await s.api
          .post(convertUrl('missing'))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        404,
        'errors.notFound',
      );
    });

    it('not a taxi -> errors.vehicleNotTaxi', async () => {
      const car = await f.taxi({ isTaxi: false });
      expect((await vehicle(car.id)).canConvert).toEqual({
        allowed: false,
        blockers: ['errors.vehicleNotTaxi'],
      });
      expectError(
        await s.api
          .post(convertUrl(car.id))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        409,
        'errors.vehicleNotTaxi',
      );
    });

    it('not ours -> errors.vehicleNotAvailable', async () => {
      const driver = await f.driver();
      const car = await f.driverCar(driver.id);
      expect((await vehicle(car.id)).canConvert.blockers).toEqual([
        'errors.vehicleNotAvailable',
        'errors.invalidTransition',
      ]);
      expectError(
        await s.api
          .post(convertUrl(car.id))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        409,
        'errors.vehicleNotAvailable',
      );
    });

    it('on a lease -> errors.vehicleLeased', async () => {
      const lease = await f.activeLease();
      const carId = lease.currentSegment?.vehicle?.id as string;
      const v = await vehicle(carId);
      expect(v.status).toBe('LEASED');
      expect(v.canConvert.blockers).toContain('errors.vehicleLeased');
      expectError(
        await s.api
          .post(convertUrl(carId))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        409,
        'errors.vehicleLeased',
      );
    });

    it('scrapped (any status but IN_STOCK / RESERVED / LEASED) -> errors.invalidTransition', async () => {
      const taxi = await f.taxi();
      ok(await s.api.post(`/api/vehicles/${taxi.id}/status`).send({ status: 'SCRAPPED' }));
      expectError(
        await s.api
          .post(convertUrl(taxi.id))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        409,
        'errors.invalidTransition',
      );
    });

    it('taxi licence still registered -> errors.licenseStillRegistered', async () => {
      const taxi = await f.taxi();
      const lic = await f.license();
      ok(
        await s.api
          .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
          .send({ vehicleId: taxi.id }),
      );
      expect((await vehicle(taxi.id)).canConvert).toEqual({
        allowed: false,
        blockers: ['errors.licenseStillRegistered'],
      });
      expectError(
        await s.api
          .post(convertUrl(taxi.id))
          .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: 0 }),
        409,
        'errors.licenseStillRegistered',
      );
    });

    it('plate rules: same plate, taxi plate, used by a vehicle, retired by another vehicle', async () => {
      const taxi = await f.taxi();
      const send = (body: Record<string, unknown>) =>
        s.api.post(convertUrl(taxi.id)).send({ convertedAt: today(), conversionTax: 0, ...body });
      expectError(await send({ newPlateNo: taxi.plateNo }), 400, 'errors.validation', [
        { path: 'newPlateNo', message: 'validation.samePlate' },
      ]);
      for (const plate of ['1234525', '12345626']) {
        expectError(await send({ newPlateNo: plate }), 400, 'errors.validation', [
          { path: 'newPlateNo', message: 'validation.privatePlateExpected' },
        ]);
      }
      const other = await privateCar();
      const duplicate = [{ path: 'newPlateNo', message: 'validation.duplicate' }];
      expectError(await send({ newPlateNo: other.plateNo }), 409, 'errors.conflict', duplicate);

      // A taxi whose plate is not a 25/26 plate converts; its old plate is retired.
      const oddTaxi = await f.taxi({ plateNo: '7001234' });
      await convert(oddTaxi.id, { newPlateNo: '7001299', conversionTax: 0 });
      expectError(await send({ newPlateNo: '70-012-34' }), 409, 'errors.conflict', duplicate);
    });

    it('date rules: not in the future, not before the open cycle started', async () => {
      const taxi = await f.taxi(); // its cycle starts today
      const send = (convertedAt: string) =>
        s.api
          .post(convertUrl(taxi.id))
          .send({ convertedAt, newPlateNo: privatePlate(), conversionTax: 0 });
      expectError(await send(daysFromToday(1)), 400, 'errors.validation', [
        { path: 'convertedAt', message: 'validation.dateInFuture' },
      ]);
      expectError(await send(daysFromToday(-1)), 400, 'errors.validation', [
        { path: 'convertedAt', message: 'validation.outsideCycle' },
      ]);
    });

    it('body validation: customs >= 0, plate format, vendor must exist', async () => {
      const taxi = await f.taxi();
      const bad = await s.api
        .post(convertUrl(taxi.id))
        .send({ convertedAt: today(), newPlateNo: privatePlate(), conversionTax: -1 });
      expect(bad.status).toBe(400);
      expect((bad.body as { errors: { path: string }[] }).errors.map((e) => e.path)).toEqual([
        'conversionTax',
      ]);
      const plate = await s.api
        .post(convertUrl(taxi.id))
        .send({ convertedAt: today(), newPlateNo: '12', conversionTax: 0 });
      expect(plate.status).toBe(400);
      expectError(
        await s.api.post(convertUrl(taxi.id)).send({
          convertedAt: today(),
          newPlateNo: privatePlate(),
          conversionTax: 100,
          vendorId: 'missing',
        }),
        404,
        'errors.notFound',
        [{ path: 'vendorId', message: 'errors.notFound' }],
      );
    });
  });

  /* ------------------------------------------------------------------------------------ */
  /* Correction                                                                           */
  /* ------------------------------------------------------------------------------------ */

  describe('PATCH /vehicles/:id/conversion', () => {
    it('404 when the vehicle was never converted (or does not exist)', async () => {
      const taxi = await f.taxi();
      expectError(await s.api.patch(correctUrl(taxi.id)).send({}), 404, 'errors.notFound');
      expectError(await s.api.patch(correctUrl('missing')).send({}), 404, 'errors.notFound');
    });

    it('keeps the plate, date and customs expense in sync (created / updated / deleted)', async () => {
      const taxi = await f.taxi({ listingPrice: 40_000 });
      const first = privatePlate();
      let v = await convert(taxi.id, { newPlateNo: first, conversionTax: 0 });
      expect(v).toMatchObject({ plateNo: first, listingPrice: 40_000 });
      expect(v.plateHistory[0]).toMatchObject({ conversionTax: 0, expenseId: null });
      expect(await expenses(taxi.id)).toEqual([]);

      // Customs entered afterwards: the expense is created on the open cycle.
      v = ok(await s.api.patch(correctUrl(taxi.id)).send({ conversionTax: 12_000 }));
      const expenseId = v.plateHistory[0]?.expenseId as string;
      expect(expenseId).toEqual(expect.any(String));
      expect(await expenses(taxi.id)).toEqual([
        expect.objectContaining({
          id: expenseId,
          category: 'CONVERSION_TAX',
          amount: 12_000,
          date: today(),
          cycleId: v.openCycle?.id,
        }),
      ]);

      // Typo in the new plate + another amount: plate, history, expense follow.
      const second = privatePlate();
      v = ok(
        await s.api
          .patch(correctUrl(taxi.id))
          .send({ newPlateNo: second, conversionTax: 12_500, notes: 'תוקן' }),
      );
      expect(v).toMatchObject({ plateNo: second, formerTaxiPlateNo: taxi.plateNo });
      expect(v.plateHistory).toEqual([
        expect.objectContaining({
          oldPlateNo: taxi.plateNo,
          newPlateNo: second,
          conversionTax: 12_500,
          expenseId,
          notes: 'תוקן',
        }),
      ]);
      const [updated] = await expenses(taxi.id);
      expect(updated).toMatchObject({
        id: expenseId,
        amount: 12_500,
        description: `Taxi to private conversion, ${formatPlate(taxi.plateNo)} → ${formatPlate(second)}`,
      });
      expect(await pnlCosts(taxi.id)).toMatchObject({ conversionTax: 12_500, expenses: 0 });

      // The rules apply to corrections too.
      expectError(
        await s.api.patch(correctUrl(taxi.id)).send({ newPlateNo: taxi.plateNo }),
        400,
        'errors.validation',
        [{ path: 'newPlateNo', message: 'validation.samePlate' }],
      );
      expectError(
        await s.api.patch(correctUrl(taxi.id)).send({ newPlateNo: '1234525' }),
        400,
        'errors.validation',
        [{ path: 'newPlateNo', message: 'validation.privatePlateExpected' }],
      );
      const other = await privateCar();
      expectError(
        await s.api.patch(correctUrl(taxi.id)).send({ newPlateNo: other.plateNo }),
        409,
        'errors.conflict',
        [{ path: 'newPlateNo', message: 'validation.duplicate' }],
      );
      expectError(
        await s.api.patch(correctUrl(taxi.id)).send({ convertedAt: daysFromToday(1) }),
        400,
        'errors.validation',
        [{ path: 'convertedAt', message: 'validation.dateInFuture' }],
      );
      expectError(
        await s.api.patch(correctUrl(taxi.id)).send({ convertedAt: daysFromToday(-1) }),
        400,
        'errors.validation',
        [{ path: 'convertedAt', message: 'validation.outsideCycle' }],
      );

      // Customs back to 0: the expense is deleted.
      v = ok(await s.api.patch(correctUrl(taxi.id)).send({ conversionTax: 0 }));
      expect(v.plateHistory[0]).toMatchObject({ conversionTax: 0, expenseId: null });
      expect(await expenses(taxi.id)).toEqual([]);
      expect(await pnlCosts(taxi.id)).toMatchObject({ conversionTax: 0 });
    });

    it('moves the date of the conversion and of its expense', async () => {
      const seller = await contact({ firstName: 'סמי', lastName: 'בדיקה' });
      const bought = ok<DealBody>(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: {
            create: {
              plateNo: f.nextPlate(),
              make: 'Kia',
              model: 'Niro',
              year: 2021,
              isTaxi: true,
            },
          },
          counterpartyId: seller.id,
          date: daysFromToday(-20),
          price: 40_000,
        }),
        201,
      );
      await convert(bought.vehicleId, { conversionTax: 14_000 });
      const v = ok<VehicleBody>(
        await s.api.patch(correctUrl(bought.vehicleId)).send({ convertedAt: daysFromToday(-5) }),
      );
      expect(v.convertedAt).toBe(daysFromToday(-5));
      expect(v.plateHistory[0]?.changedAt).toBe(daysFromToday(-5));
      expect((await expenses(bought.vehicleId))[0]).toMatchObject({
        date: daysFromToday(-5),
        amount: 14_000,
        cycleId: bought.cycleId,
      });
    });
  });

  /* ------------------------------------------------------------------------------------ */
  /* Taxi-only reminders and alerts                                                       */
  /* ------------------------------------------------------------------------------------ */

  describe('taxi reminders', () => {
    it('taxi age reminders and alerts stop once the car is converted', async () => {
      // A 2014 taxi is past the 12-year limit (1 January 2026): overdue taxiAge item + alert.
      const old = await f.taxi({ year: 2014 });
      const feedIds = async () =>
        ok<{ items: { entityId: string }[] }>(
          await s.api.get('/api/reminders/feed?kinds=taxiAge&days=365&pageSize=200'),
        ).items.map((i) => i.entityId);
      expect(await feedIds()).toContain(old.id);
      expect((await vehicle(old.id)).alerts).toContain('taxiAgeBlocked');

      const v = await convert(old.id, { conversionTax: 0 });
      expect(v.alerts.filter((a) => a.startsWith('taxi'))).toEqual([]);
      expect(await feedIds()).not.toContain(old.id);
    });
  });
});
