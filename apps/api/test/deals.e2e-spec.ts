import {
  addDays,
  addWorkingDays,
  DashboardKpisSchema,
  periodOf,
  sumMoney,
  vatOnMargin,
} from '@renawi/shared';
import request from 'supertest';
import { Factory, LeaseBody, LedgerEntryBody, Ref } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

interface DealBody {
  id: string;
  dealNo: number;
  type: string;
  status: string;
  vehicleId: string;
  cycleId: string | null;
  counterpartyId: string;
  date: string;
  price: number;
  listPrice: number | null;
  vatMode: string;
  vatRate: number;
  sellerIsVatBusiness: boolean;
  isTradeIn: boolean;
  tradeInDealId: string | null;
  commissionAmount: number | null;
  payoutAmount: number | null;
  warrantyText: string | null;
  disclosureSignedAt: string | null;
  transferStatus: string;
  transferChecklist: Record<string, unknown>;
  transferDueAt: string | null;
  transferredAt: string | null;
  notes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  vehicle: { id: string; plateNo: string; make: string; model: string; year: number };
  counterparty: { id: string; name: string };
  paidIn: number;
  paidOut: number;
  tradeInValue: number;
  balanceDue: number;
  payoutDue: number | null;
  alerts: string[];
  cycle: {
    id: string;
    kind: string;
    startedAt: string;
    endedAt: string | null;
    endReason: string | null;
    purchasePrice: number | null;
    consignor: { id: string; name: string } | null;
    commissionMode: string | null;
    commissionValue: number | null;
    minNetToConsignor: number | null;
  } | null;
  tradeInDeal: {
    id: string;
    dealNo: number;
    vehicle: { id: string; plateNo: string; make: string; model: string };
    price: number;
    status: string;
  } | null;
  tradeInFor: { id: string; dealNo: number } | null;
  payments: {
    id: string;
    direction: string;
    method: string;
    amount: number;
    date: string;
    contactId: string | null;
    contact: { id: string; name: string } | null;
    reference: string | null;
  }[];
  vat: { mode: string; rate: number; base: number; amount: number };
  documentCount: number;
}

interface VehicleBody {
  id: string;
  plateNo: string;
  status: string;
  ownership: string;
  listingPrice: number | null;
  openCycle: { id: string; kind: string; startedAt: string } | null;
}

interface CycleBody {
  id: string;
  kind: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  purchaseDealId: string | null;
  saleDealId: string | null;
}

interface CyclePnlBody {
  id: string;
  kind: string;
  startedAt: string;
  endedAt: string | null;
  open: boolean;
  purchasePrice: number | null;
  salePrice: number | null;
  listingPrice: number | null;
  commission: number | null;
  revenue: {
    sale: number;
    commission: number;
    leaseIncome: number;
    rebilled: number;
    total: number;
  };
  costs: { purchase: number; expenses: number; vatOnMargin: number; total: number };
  profit: number;
  unrealised: boolean;
}

interface VehiclePnlBody {
  cycles: CyclePnlBody[];
  totals: { revenue: number; costs: number; profit: number };
}

interface ExpenseBody {
  id: string;
  amount: number;
  rebilledEntryId: string | null;
}

describe('Deals (e2e)', () => {
  let s: Session;
  let f: Factory;
  let sellerId: string;
  let buyerId: string;
  let consignorId: string;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 6);
    sellerId = (await contact({ firstName: 'יוסי', lastName: 'כהן' })).id;
    buyerId = (await contact({ firstName: 'محمد', lastName: 'حلبي', phones: ['052-887-6543'] })).id;
    consignorId = (await contact({ firstName: 'سامر', lastName: 'نصار' })).id;
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  /* -------------------------------------------------------------------------------- */

  function ok<T>(res: { status: number; body: unknown }, status = 200): T {
    expect({ status: res.status, body: res.status === status ? 'ok' : res.body }).toEqual({
      status,
      body: 'ok',
    });
    return res.body as T;
  }

  async function contact(body: Record<string, unknown>): Promise<Ref & { tags: string[] }> {
    return ok(await s.api.post('/api/contacts').send(body), 201);
  }

  async function tagsOf(id: string): Promise<string[]> {
    return ok<{ tags: string[] }>(await s.api.get(`/api/contacts/${id}`)).tags;
  }

  async function newVehicle(body: Record<string, unknown> = {}): Promise<VehicleBody> {
    return ok(
      await s.api
        .post('/api/vehicles')
        .send({ plateNo: f.nextPlate(), make: 'Mazda', model: '3', year: 2019, ...body }),
      201,
    );
  }

  async function vehicle(id: string): Promise<VehicleBody> {
    return ok(await s.api.get(`/api/vehicles/${id}`));
  }

  async function cyclesOf(id: string): Promise<CycleBody[]> {
    return ok(await s.api.get(`/api/vehicles/${id}/cycles`));
  }

  async function create(body: Record<string, unknown>): Promise<DealBody> {
    return ok(await s.api.post('/api/deals').send(body), 201);
  }

  async function deal(id: string): Promise<DealBody> {
    return ok(await s.api.get(`/api/deals/${id}`));
  }

  function inline(body: Record<string, unknown> = {}) {
    return {
      create: { plateNo: f.nextPlate(), make: 'Hyundai', model: 'i20', year: 2017, ...body },
    };
  }

  async function purchase(body: Record<string, unknown> = {}): Promise<DealBody> {
    return create({
      type: 'PURCHASE',
      vehicle: inline({ make: 'Mazda', model: '3', year: 2019 }),
      counterpartyId: sellerId,
      date: daysFromToday(-30),
      price: 50_000,
      ...body,
    });
  }

  async function sale(vehicleId: string, body: Record<string, unknown> = {}): Promise<DealBody> {
    return create({
      type: 'SALE',
      vehicleId,
      counterpartyId: buyerId,
      date: today(),
      price: 59_000,
      ...body,
    });
  }

  async function sign(id: string): Promise<DealBody> {
    return ok(
      await s.api.post(`/api/deals/${id}/disclosure`).send({ signedAt: new Date().toISOString() }),
    );
  }

  async function complete(id: string, body: Record<string, unknown> = {}): Promise<DealBody> {
    return ok(await s.api.post(`/api/deals/${id}/complete`).send(body));
  }

  async function cancel(id: string, body: Record<string, unknown> = {}): Promise<DealBody> {
    return ok(await s.api.post(`/api/deals/${id}/cancel`).send(body));
  }

  async function pay(id: string, body: Record<string, unknown>): Promise<DealBody> {
    return ok(
      await s.api
        .post(`/api/deals/${id}/payments`)
        .send({ direction: 'IN', date: today(), method: 'CASH', ...body }),
      201,
    );
  }

  /** Alerts of a completed sale with nothing owed, by its transfer due date (lead 2 days). */
  function transferAlerts(due: string): string[] {
    if (due < today()) return ['transferOverdue'];
    if (due <= addDays(today(), 2)) return ['transferDue'];
    return [];
  }

  /* -------------------------------------------------------------------------------- */

  it('requires authentication', async () => {
    expect((await request(s.t.http).get('/api/deals')).status).toBe(401);
    expect((await request(s.t.http).get('/api/dashboard/kpis')).status).toBe(401);
  });

  describe('purchase', () => {
    it('creates the vehicle and an OWNED cycle; DRAFT, VAT NONE, seller tagged SELLER', async () => {
      const date = daysFromToday(-20);
      const d = await purchase({
        vehicle: inline({ make: 'Kia', model: 'Picanto', year: 2020, listingPrice: 58_000 }),
        date,
        price: 50_000,
        listPrice: 54_000,
        notes: 'קנייה מפרטי',
      });
      expect(d).toMatchObject({
        type: 'PURCHASE',
        status: 'DRAFT',
        counterpartyId: sellerId,
        counterparty: { id: sellerId, name: 'יוסי כהן' },
        date,
        price: 50_000,
        listPrice: 54_000,
        vatMode: 'NONE',
        vatRate: 18,
        sellerIsVatBusiness: false,
        isTradeIn: false,
        vehicle: { make: 'Kia', model: 'Picanto', year: 2020 },
        cycle: { kind: 'OWNED', startedAt: date, endedAt: null, purchasePrice: 50_000 },
        paidIn: 0,
        paidOut: 0,
        tradeInValue: 0,
        balanceDue: 50_000,
        payoutDue: null,
        vat: { mode: 'NONE', rate: 18, base: 0, amount: 0 },
        tradeInDeal: null,
        tradeInFor: null,
        payments: [],
        alerts: [],
        documentCount: 0,
        transferStatus: 'NOT_STARTED',
      });
      expect(typeof d.dealNo).toBe('number');
      expect(d.cycleId).toBe(d.cycle?.id);
      expect(d.transferChecklist).toMatchObject({ idCopies: false, transferFiled: false });
      expect(d.transferChecklist).not.toHaveProperty('taxiLicenseDetached');

      const v = await vehicle(d.vehicleId);
      expect(v).toMatchObject({ status: 'IN_STOCK', ownership: 'OWNED', listingPrice: 58_000 });
      expect(v.openCycle?.id).toBe(d.cycleId);
      const [cycle] = await cyclesOf(d.vehicleId);
      expect(cycle).toMatchObject({ purchaseDealId: d.id, askingPrice: 58_000 });
      expect(await tagsOf(sellerId)).toContain('SELLER');
    });

    it('a VAT-registered seller -> FULL; purchase-less stock gets the deal attached', async () => {
      const stock = await newVehicle();
      const date = daysFromToday(-45);
      const d = await purchase({
        vehicle: { id: stock.id },
        sellerIsVatBusiness: true,
        price: 92_000,
        date,
      });
      expect(d).toMatchObject({
        vehicleId: stock.id,
        cycleId: stock.openCycle?.id,
        vatMode: 'FULL',
        sellerIsVatBusiness: true,
        vat: { mode: 'FULL', rate: 18, base: 92_000, amount: 14_033.9 },
        // The stock cycle started today; the earlier purchase date moves it back.
        cycle: { id: stock.openCycle?.id, startedAt: date },
      });
      expect((await vehicle(stock.id)).status).toBe('IN_STOCK');
      // The cycle now has a purchase deal: another purchase is refused.
      expectError(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: { id: stock.id },
          counterpartyId: sellerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.cycleOpen',
      );
    });

    it('refuses cars with another open cycle or on a lease', async () => {
      const consigned = await newVehicle({ status: 'EXTERNAL' });
      ok(
        await s.api.post(`/api/vehicles/${consigned.id}/consign`).send({
          consignorId,
          askingPrice: 50_000,
          commissionMode: 'FIXED',
          commissionValue: 2000,
        }),
      );
      const body = { type: 'PURCHASE', counterpartyId: sellerId, date: today(), price: 1000 };
      expectError(
        await s.api.post('/api/deals').send({ ...body, vehicle: { id: consigned.id } }),
        409,
        'errors.cycleOpen',
      );
      // By plate (any format) as well.
      const dashed = `${consigned.plateNo.slice(0, 2)}-${consigned.plateNo.slice(2)}`;
      expectError(
        await s.api.post('/api/deals').send({
          ...body,
          vehicle: { create: { plateNo: dashed, make: 'X', model: 'Y', year: 2020 } },
        }),
        409,
        'errors.cycleOpen',
      );
      // A driver's own car on a number-only lease.
      const driver = await f.driver();
      const own = await f.driverCar(driver.id);
      await f.activeLease({ type: 'NUMBER_ONLY', driverId: driver.id, vehicleId: own.id });
      expectError(
        await s.api.post('/api/deals').send({ ...body, vehicle: { id: own.id } }),
        409,
        'errors.vehicleLeased',
      );
    });

    it('completes (the cycle stays open) once; validates the body', async () => {
      const d = await purchase();
      const done = await complete(d.id);
      expect(done).toMatchObject({ status: 'COMPLETED', cycle: { endedAt: null } });
      expect(done.completedAt).not.toBeNull();
      expectError(await s.api.post(`/api/deals/${d.id}/complete`), 409, 'errors.invalidTransition');

      const base = { counterpartyId: sellerId, date: today(), price: 1000 };
      expectError(
        await s.api.post('/api/deals').send({ ...base, type: 'LEASE' }),
        400,
        'errors.validation',
        [{ path: 'type', message: 'validation.invalidOption' }],
      );
      expectError(
        await s.api.post('/api/deals').send({ ...base, type: 'PURCHASE', vehicle: {} }),
        400,
        'errors.validation',
        [{ path: 'vehicle', message: 'validation.vehicleRequired' }],
      );
      expectError(
        await s.api.post('/api/deals').send({ ...base, type: 'PURCHASE', vehicle: { id: 'nope' } }),
        404,
        'errors.notFound',
        [{ path: 'vehicle.id', message: 'errors.notFound' }],
      );
      expectError(
        await s.api
          .post('/api/deals')
          .send({ ...base, counterpartyId: 'nope', type: 'PURCHASE', vehicle: inline() }),
        404,
        'errors.notFound',
        [{ path: 'counterpartyId', message: 'errors.notFound' }],
      );
      const res = await s.api
        .post('/api/deals')
        .send({ ...base, type: 'PURCHASE', vehicle: { create: { plateNo: '12' } }, price: -5 });
      expect(res.status).toBe(400);
      const paths = (res.body as { errors: { path: string }[] }).errors.map((e) => e.path);
      expect(paths).toEqual(
        expect.arrayContaining(['vehicle.create.plateNo', 'vehicle.create.make', 'price']),
      );
      expectError(await s.api.get('/api/deals/nope'), 404, 'errors.notFound');
    });
  });

  describe('sale', () => {
    it('needs an open OWNED cycle, no lease and no other pending sale; reserves the car', async () => {
      const external = await newVehicle({ status: 'EXTERNAL' });
      expectError(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId: external.id,
          counterpartyId: buyerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.noOpenCycle',
      );
      const lease = await f.activeLease();
      expectError(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId: lease.currentSegment?.vehicle?.id,
          counterpartyId: buyerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.vehicleLeased',
      );

      const p = await purchase();
      const d = await sale(p.vehicleId, { warrantyText: 'אחריות 3 חודשים' });
      expect(d).toMatchObject({
        type: 'SALE',
        status: 'DRAFT',
        cycleId: p.cycleId,
        vatMode: 'MARGIN',
        warrantyText: 'אחריות 3 חודשים',
        vehicle: { id: p.vehicleId },
        balanceDue: 59_000,
        alerts: ['disclosureMissing'],
        cycle: { id: p.cycleId, purchasePrice: 50_000 },
        vat: { mode: 'MARGIN', rate: 18, base: 9000, amount: 1372.88 },
      });
      expect((await vehicle(p.vehicleId)).status).toBe('RESERVED');
      expect(await tagsOf(buyerId)).toContain('BUYER');
      expectError(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId: p.vehicleId,
          counterpartyId: buyerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.dealPending',
      );
      // The reservation is released by cancelling the deal, not by hand.
      expectError(
        await s.api.post(`/api/vehicles/${p.vehicleId}/status`).send({ status: 'IN_STOCK' }),
        409,
        'errors.dealPending',
      );
    });

    it('margin VAT by default; FULL is forced after a VAT-business purchase', async () => {
      const p = await purchase({ sellerIsVatBusiness: true, price: 92_000 });
      const d = await sale(p.vehicleId, { price: 107_500, vatMode: 'MARGIN' });
      expect(d).toMatchObject({
        vatMode: 'FULL',
        vat: { mode: 'FULL', rate: 18, base: 107_500, amount: 16_398.31 },
      });
      expectError(
        await s.api.patch(`/api/deals/${d.id}`).send({ vatMode: 'NONE' }),
        400,
        'errors.validation',
        [{ path: 'vatMode', message: 'validation.invalidOption' }],
      );
      // MARGIN stays FULL; the price change recomputes the VAT block.
      const patched = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}`).send({ vatMode: 'MARGIN', price: 106_200 }),
      );
      expect(patched).toMatchObject({ vatMode: 'FULL', price: 106_200, vat: { amount: 16_200 } });

      // A private purchase switched to a VAT business forces FULL on the open sale too.
      const q = await purchase({ price: 50_000 });
      const s2 = await sale(q.vehicleId, { price: 49_000 });
      expect(s2.vat).toEqual({ mode: 'MARGIN', rate: 18, base: 0, amount: 0 });
      const flipped = ok<DealBody>(
        await s.api.patch(`/api/deals/${q.id}`).send({ sellerIsVatBusiness: true }),
      );
      expect(flipped).toMatchObject({ vatMode: 'FULL', sellerIsVatBusiness: true });
      expect((await deal(s2.id)).vatMode).toBe('FULL');
      expectError(
        await s.api.patch(`/api/deals/${q.id}`).send({ vatMode: 'NONE' }),
        400,
        'errors.validation',
        [{ path: 'vatMode', message: 'validation.invalidOption' }],
      );
      expectError(
        await s.api.patch(`/api/deals/${s2.id}`).send({ sellerIsVatBusiness: true }),
        400,
        'errors.validation',
        [{ path: 'sellerIsVatBusiness', message: 'validation.invalidValue' }],
      );
    });

    describe('with a trade-in', () => {
      let p: DealBody;
      let d: DealBody;
      let tradePlate: string;
      const saleDate = daysFromToday(-15);

      beforeAll(async () => {
        p = await purchase({ price: 72_000, date: daysFromToday(-60) });
        tradePlate = f.nextPlate();
        d = await sale(p.vehicleId, {
          price: 89_900,
          date: saleDate,
          tradeIn: {
            vehicle: {
              create: {
                plateNo: tradePlate,
                make: 'Hyundai',
                model: 'i20',
                year: 2017,
                listingPrice: 46_900,
              },
            },
            value: 38_000,
            listPrice: 42_000,
          },
        });
      });

      it('creates the linked PURCHASE, its cycle and TRADE_IN payments on both deals', async () => {
        expect(d).toMatchObject({
          status: 'DRAFT',
          tradeInValue: 38_000,
          paidIn: 0,
          balanceDue: 51_900,
          tradeInDeal: {
            vehicle: { plateNo: tradePlate, make: 'Hyundai', model: 'i20' },
            price: 38_000,
            status: 'PENDING',
          },
          payments: [
            {
              direction: 'IN',
              method: 'TRADE_IN',
              amount: 38_000,
              date: saleDate,
              contactId: buyerId,
              contact: { id: buyerId },
              reference: tradePlate,
            },
          ],
        });
        const trade = await deal(d.tradeInDeal?.id as string);
        expect(trade).toMatchObject({
          id: d.tradeInDealId,
          type: 'PURCHASE',
          isTradeIn: true,
          status: 'PENDING',
          counterpartyId: buyerId,
          date: saleDate,
          price: 38_000,
          listPrice: 42_000,
          vatMode: 'NONE',
          tradeInFor: { id: d.id, dealNo: d.dealNo },
          tradeInValue: 38_000,
          balanceDue: 0,
          payments: [{ direction: 'OUT', method: 'TRADE_IN', amount: 38_000 }],
          cycle: { kind: 'OWNED', startedAt: saleDate, endedAt: null, purchasePrice: 38_000 },
        });
        expect(await vehicle(trade.vehicleId)).toMatchObject({
          plateNo: tradePlate,
          status: 'IN_STOCK',
          ownership: 'OWNED',
        });
        expect(await tagsOf(buyerId)).toEqual(expect.arrayContaining(['BUYER', 'SELLER']));
      });

      it('locks the trade-in value and its system payments', async () => {
        const tradeId = d.tradeInDealId as string;
        expectError(
          await s.api.patch(`/api/deals/${tradeId}`).send({ price: 40_000, notes: 'x' }),
          409,
          'errors.dealNotEditable',
          [{ path: 'price', message: 'errors.dealNotEditable' }],
        );
        expectError(
          await s.api.patch(`/api/deals/${d.id}`).send({ price: 30_000 }),
          400,
          'errors.validation',
          [{ path: 'price', message: 'validation.invalidAmount' }],
        );
        expectError(
          await s.api.del(`/api/deal-payments/${d.payments[0]?.id}`),
          409,
          'errors.systemPayment',
        );
        expectError(
          await s.api.post(`/api/deals/${tradeId}/cancel`),
          409,
          'errors.dealNotCancellable',
        );
        expectError(
          await s.api.post(`/api/deals/${tradeId}/complete`),
          409,
          'errors.invalidTransition',
        );
        expectError(
          await s.api.post('/api/deals').send({
            type: 'SALE',
            vehicleId: p.vehicleId,
            counterpartyId: buyerId,
            date: today(),
            price: 1000,
            tradeIn: { vehicle: inline(), value: 2000 },
          }),
          400,
          'errors.validation',
          [{ path: 'tradeIn.value', message: 'validation.invalidAmount' }],
        );
      });

      it('completes only with the signed disclosure: cycle SOLD, transferDueAt, trade-in done', async () => {
        expectError(
          await s.api.post(`/api/deals/${d.id}/complete`),
          409,
          'errors.disclosureRequired',
        );
        expectError(
          await s.api
            .post(`/api/deals/${p.id}/disclosure`)
            .send({ signedAt: new Date().toISOString() }),
          409,
          'errors.invalidTransition',
        );
        const signed = await sign(d.id);
        expect(signed.disclosureSignedAt).not.toBeNull();
        expect(signed.alerts).toEqual([]);

        const done = await complete(d.id, { date: saleDate });
        const due = addWorkingDays(saleDate, 6);
        expect(done).toMatchObject({
          status: 'COMPLETED',
          transferDueAt: due,
          transferStatus: 'NOT_STARTED',
          cycle: { id: p.cycleId, endedAt: saleDate, endReason: 'SOLD' },
          tradeInDeal: { status: 'COMPLETED' },
        });
        expect([...done.alerts].sort()).toEqual(['unpaid', ...transferAlerts(due)].sort());
        expect(done.completedAt).not.toBeNull();
        expect(await vehicle(p.vehicleId)).toMatchObject({ status: 'SOLD', openCycle: null });
        const [cycle] = await cyclesOf(p.vehicleId);
        expect(cycle).toMatchObject({ saleDealId: d.id, endReason: 'SOLD', endedAt: saleDate });
        expect((await deal(d.tradeInDealId as string)).status).toBe('COMPLETED');

        // Paying the rest clears "unpaid".
        const paid = await pay(d.id, {
          amount: 51_900,
          method: 'BANK_TRANSFER',
          reference: '77812',
        });
        expect(paid).toMatchObject({ paidIn: 51_900, balanceDue: 0 });
        expect(paid.alerts).toEqual(transferAlerts(due));

        expectError(
          await s.api.post(`/api/deals/${d.id}/complete`),
          409,
          'errors.invalidTransition',
        );
        expectError(
          await s.api.post(`/api/deals/${d.id}/cancel`),
          409,
          'errors.dealNotCancellable',
        );
        expectError(
          await s.api.patch(`/api/deals/${d.id}`).send({ price: 90_000, notes: 'x' }),
          409,
          'errors.dealNotEditable',
          [{ path: 'price', message: 'errors.dealNotEditable' }],
        );
        expect(
          ok<DealBody>(
            await s.api.patch(`/api/deals/${d.id}`).send({ notes: 'נמסר', price: 89_900 }),
          ),
        ).toMatchObject({ notes: 'נמסר', price: 89_900 });
        expectError(
          await s.api.post(`/api/deals/${d.id}/disclosure`).send({ signedAt: null }),
          409,
          'errors.dealNotEditable',
          [{ path: 'signedAt', message: 'errors.dealNotEditable' }],
        );
      });

      it('buy-back: the sold car comes back as a trade-in with a second cycle', async () => {
        const other = await purchase({ price: 30_000 });
        const back = await sale(other.vehicleId, {
          price: 40_000,
          tradeIn: { vehicle: { id: p.vehicleId }, value: 25_000 },
        });
        expect(back.tradeInDeal?.vehicle.id).toBe(p.vehicleId);
        const cycles = await cyclesOf(p.vehicleId);
        expect(cycles).toHaveLength(2);
        expect(cycles[0]).toMatchObject({ endedAt: null, purchaseDealId: back.tradeInDealId });
        expect(cycles[1]).toMatchObject({ endReason: 'SOLD' });
        expect(await vehicle(p.vehicleId)).toMatchObject({
          status: 'IN_STOCK',
          ownership: 'OWNED',
        });

        // ...and by plate through a purchase (buy-back of the same record).
        const sold = await purchase();
        const s3 = await sale(sold.vehicleId);
        await sign(s3.id);
        await complete(s3.id);
        const plate = (await vehicle(sold.vehicleId)).plateNo;
        const again = await purchase({
          vehicle: {
            create: { plateNo: plate, make: 'Mazda', model: '3', year: 2019, currentKm: 99_000 },
          },
          date: today(),
        });
        expect(again.vehicleId).toBe(sold.vehicleId);
        expect(again.cycleId).not.toBe(sold.cycleId);
        expect(await cyclesOf(sold.vehicleId)).toHaveLength(2);
      });
    });
  });

  describe('consignment sale', () => {
    it('SURPLUS commission, payout and payoutDue; completion keeps CONSIGNED ownership', async () => {
      const v = await newVehicle({ status: 'EXTERNAL', make: 'Toyota', model: 'RAV4' });
      const consigned = ok<VehicleBody>(
        await s.api.post(`/api/vehicles/${v.id}/consign`).send({
          consignorId,
          askingPrice: 132_000,
          minNetToConsignor: 120_000,
          commissionMode: 'SURPLUS',
        }),
      );
      expectError(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId: v.id,
          counterpartyId: buyerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.noOpenCycle',
      );
      const owned = await purchase();
      expectError(
        await s.api.post('/api/deals').send({
          type: 'CONSIGNMENT_SALE',
          vehicleId: owned.vehicleId,
          counterpartyId: buyerId,
          date: today(),
          price: 1000,
        }),
        409,
        'errors.noOpenCycle',
      );

      const d = await create({
        type: 'CONSIGNMENT_SALE',
        vehicleId: v.id,
        counterpartyId: buyerId,
        date: today(),
        price: 128_000,
      });
      expect(d).toMatchObject({
        type: 'CONSIGNMENT_SALE',
        status: 'DRAFT',
        cycleId: consigned.openCycle?.id,
        vatMode: 'NONE',
        commissionAmount: 8000,
        payoutAmount: 120_000,
        balanceDue: 128_000,
        payoutDue: 120_000,
        vat: { mode: 'NONE', base: 0, amount: 0 },
        cycle: {
          kind: 'CONSIGNED',
          consignor: { id: consignorId },
          commissionMode: 'SURPLUS',
          minNetToConsignor: 120_000,
          purchasePrice: null,
        },
        alerts: ['disclosureMissing'],
      });
      expect((await vehicle(v.id)).status).toBe('RESERVED');

      const repriced = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}`).send({ price: 131_500 }),
      );
      expect(repriced).toMatchObject({ commissionAmount: 11_500, payoutAmount: 120_000 });
      expectError(
        await s.api.patch(`/api/deals/${d.id}`).send({ vatMode: 'MARGIN' }),
        400,
        'errors.validation',
        [{ path: 'vatMode', message: 'validation.invalidOption' }],
      );

      await pay(d.id, { amount: 131_500, method: 'BANK_TRANSFER' });
      const payout = await pay(d.id, {
        direction: 'OUT',
        amount: 100_000,
        method: 'BANK_TRANSFER',
      });
      expect(payout).toMatchObject({
        paidIn: 131_500,
        paidOut: 100_000,
        balanceDue: 0,
        payoutDue: 20_000,
      });
      expect(payout.payments[1]).toMatchObject({ direction: 'OUT', contactId: consignorId });

      await sign(d.id);
      const done = await complete(d.id);
      const due = addWorkingDays(today(), 6);
      expect(done).toMatchObject({
        status: 'COMPLETED',
        commissionAmount: 11_500,
        payoutAmount: 120_000,
        transferDueAt: due,
        cycle: { endedAt: today(), endReason: 'SOLD' },
        alerts: ['unpaid'],
      });
      expect(await vehicle(v.id)).toMatchObject({ status: 'SOLD', ownership: 'CONSIGNED' });
      const settled = await pay(d.id, {
        direction: 'OUT',
        amount: 20_000,
        method: 'BANK_TRANSFER',
      });
      expect(settled).toMatchObject({ payoutDue: 0, alerts: [] });
    });
  });

  describe('cancel', () => {
    it('a sale with a trade-in: car IN_STOCK, trade-in deal + cycle cancelled, car EXTERNAL', async () => {
      const p = await purchase();
      const d = await sale(p.vehicleId, { tradeIn: { vehicle: inline(), value: 10_000 } });
      const tradeVehicleId = d.tradeInDeal?.vehicle.id as string;
      const cancelled = await cancel(d.id, { reason: 'הקונה חזר בו' });
      expect(cancelled).toMatchObject({
        status: 'CANCELLED',
        notes: 'הקונה חזר בו',
        payments: [],
        tradeInValue: 0,
        tradeInDeal: { status: 'CANCELLED' },
      });
      expect(cancelled.cancelledAt).not.toBeNull();
      expect((await vehicle(p.vehicleId)).status).toBe('IN_STOCK');
      expect((await deal(d.tradeInDealId as string)).payments).toEqual([]);
      expect(await vehicle(tradeVehicleId)).toMatchObject({ status: 'EXTERNAL', openCycle: null });
      const [tradeCycle] = await cyclesOf(tradeVehicleId);
      expect(tradeCycle).toMatchObject({ endReason: 'CANCELLED' });
      expect(tradeCycle?.endedAt).toBe(tradeCycle?.startedAt);

      // Cancelled deals are frozen.
      expectError(await s.api.post(`/api/deals/${d.id}/cancel`), 409, 'errors.dealNotCancellable');
      expectError(
        await s.api.patch(`/api/deals/${d.id}`).send({ notes: 'x' }),
        409,
        'errors.dealNotEditable',
        [{ path: 'notes', message: 'errors.dealNotEditable' }],
      );
      expectError(
        await s.api.post(`/api/deals/${d.id}/payments`).send({
          direction: 'IN',
          date: today(),
          amount: 10,
          method: 'CASH',
        }),
        409,
        'errors.dealNotEditable',
      );
      expectError(
        await s.api
          .post(`/api/deals/${d.id}/disclosure`)
          .send({ signedAt: new Date().toISOString() }),
        409,
        'errors.invalidTransition',
      );
      // The car can be sold again.
      expect((await sale(p.vehicleId)).status).toBe('DRAFT');
    });

    it('refuses while manual payments exist; works once they are deleted', async () => {
      const p = await purchase();
      const d = await sale(p.vehicleId);
      const withPay = await pay(d.id, { amount: 5000 });
      expectError(await s.api.post(`/api/deals/${d.id}/cancel`), 409, 'errors.dealHasPayments');
      const removed = ok<DealBody>(
        await s.api.del(`/api/deal-payments/${withPay.payments[0]?.id}`),
      );
      expect(removed).toMatchObject({ id: d.id, payments: [], paidIn: 0 });
      expectError(await s.api.del('/api/deal-payments/nope'), 404, 'errors.notFound');
      expect((await cancel(d.id)).status).toBe('CANCELLED');
    });

    it('a purchase cancels the cycle it opened; attached stock is only detached', async () => {
      const p = await purchase();
      const c = await cancel(p.id);
      expect(c).toMatchObject({ status: 'CANCELLED', cycle: { endReason: 'CANCELLED' } });
      expect(await vehicle(p.vehicleId)).toMatchObject({ status: 'EXTERNAL', openCycle: null });

      // A buy-back purchase restores the state after the earlier (sold) cycle.
      const first = await purchase();
      const s1 = await sale(first.vehicleId);
      await sign(s1.id);
      await complete(s1.id);
      const back = await purchase({ vehicle: { id: first.vehicleId }, date: today() });
      expect((await vehicle(first.vehicleId)).status).toBe('IN_STOCK');
      await cancel(back.id);
      expect(await vehicle(first.vehicleId)).toMatchObject({ status: 'SOLD', openCycle: null });

      // A purchase attached to existing stock keeps the stock cycle open.
      const stock = await newVehicle();
      const attached = await purchase({ vehicle: { id: stock.id } });
      expect(attached.cycleId).toBe(stock.openCycle?.id);
      await cancel(attached.id);
      const after = await vehicle(stock.id);
      expect(after).toMatchObject({ status: 'IN_STOCK', openCycle: { id: stock.openCycle?.id } });
      const [cycle] = await cyclesOf(stock.id);
      expect(cycle).toMatchObject({ endedAt: null, purchaseDealId: null });

      // A purchase whose car has a sale in progress cannot be cancelled.
      const busy = await purchase();
      await sale(busy.vehicleId);
      expectError(await s.api.post(`/api/deals/${busy.id}/cancel`), 409, 'errors.dealPending');
    });

    it('a consignment sale puts the car back IN_STOCK', async () => {
      const v = await newVehicle({ status: 'EXTERNAL' });
      await s.api
        .post(`/api/vehicles/${v.id}/consign`)
        .send({ consignorId, askingPrice: 40_000, commissionMode: 'PERCENT', commissionValue: 5 })
        .expect(200);
      const d = await create({
        type: 'CONSIGNMENT_SALE',
        vehicleId: v.id,
        counterpartyId: buyerId,
        date: today(),
        price: 40_000,
      });
      expect(d).toMatchObject({ commissionAmount: 2000, payoutAmount: 38_000 });
      expect((await cancel(d.id)).status).toBe('CANCELLED');
      expect(await vehicle(v.id)).toMatchObject({ status: 'IN_STOCK', ownership: 'CONSIGNED' });
    });
  });

  describe('payments', () => {
    it('validates the method and the contact; the contact defaults to the counterparty', async () => {
      const p = await purchase();
      expectError(
        await s.api
          .post(`/api/deals/${p.id}/payments`)
          .send({ direction: 'OUT', date: today(), amount: 100, method: 'TRADE_IN' }),
        400,
        'errors.validation',
        [{ path: 'method', message: 'validation.invalidOption' }],
      );
      expectError(
        await s.api.post(`/api/deals/${p.id}/payments`).send({
          direction: 'OUT',
          date: today(),
          amount: 100,
          method: 'CASH',
          contactId: 'nope',
        }),
        404,
        'errors.notFound',
        [{ path: 'contactId', message: 'errors.notFound' }],
      );
      const paid = await pay(p.id, {
        direction: 'OUT',
        amount: 20_000,
        method: 'CHECK',
        reference: '1001',
      });
      expect(paid).toMatchObject({
        paidOut: 20_000,
        balanceDue: 30_000,
        payments: [
          {
            direction: 'OUT',
            method: 'CHECK',
            amount: 20_000,
            contactId: sellerId,
            reference: '1001',
          },
        ],
      });
      await complete(p.id);
      expect((await deal(p.id)).alerts).toEqual(['unpaid']);
      const rest = await pay(p.id, { direction: 'OUT', amount: 30_000, method: 'BANK_TRANSFER' });
      expect(rest).toMatchObject({ balanceDue: 0, alerts: [] });
    });
  });

  describe('ownership transfer', () => {
    it('merges the checklist and rolls the status up (taxis also detach the licence)', async () => {
      const p = await purchase({
        vehicle: inline({ isTaxi: true, make: 'Skoda', model: 'Octavia', year: 2020 }),
      });
      const d = await sale(p.vehicleId);
      await sign(d.id);
      const done = await complete(d.id);
      expect(done.transferChecklist).toMatchObject({ taxiLicenseDetached: false });

      const step = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}/transfer`).send({ checklist: { idCopies: true } }),
      );
      expect(step).toMatchObject({
        transferStatus: 'IN_PROGRESS',
        transferredAt: null,
        transferChecklist: { idCopies: true, liensChecked: false },
      });
      const allButTaxi = {
        vehicleLicenseSigned: true,
        liensChecked: true,
        finesChecked: true,
        transferFiled: true,
        newLicenseReceived: true,
        insuranceHandled: true,
        transferFee: 43,
      };
      const almost = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}/transfer`).send({ checklist: allButTaxi }),
      );
      expect(almost).toMatchObject({
        transferStatus: 'IN_PROGRESS',
        transferChecklist: { idCopies: true, transferFee: 43 },
      });
      const full = ok<DealBody>(
        await s.api
          .patch(`/api/deals/${d.id}/transfer`)
          .send({ checklist: { taxiLicenseDetached: true } }),
      );
      expect(full).toMatchObject({
        transferStatus: 'DONE',
        transferredAt: today(),
        alerts: ['unpaid'],
      });
      // Unticking does not lower the status by itself; an explicit status does.
      const kept = ok<DealBody>(
        await s.api
          .patch(`/api/deals/${d.id}/transfer`)
          .send({ checklist: { insuranceHandled: false } }),
      );
      expect(kept).toMatchObject({ transferStatus: 'DONE', transferredAt: today() });
      const lowered = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}/transfer`).send({ transferStatus: 'IN_PROGRESS' }),
      );
      expect(lowered).toMatchObject({ transferStatus: 'IN_PROGRESS', transferredAt: null });
      const dated = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}/transfer`).send({ transferredAt: daysFromToday(-1) }),
      );
      expect(dated).toMatchObject({ transferStatus: 'DONE', transferredAt: daysFromToday(-1) });
    });

    it('a non-taxi has no licence item; overdue transfers are listed and flagged', async () => {
      const p = await purchase({ date: daysFromToday(-40) });
      const d = await sale(p.vehicleId, { date: daysFromToday(-20) });
      await sign(d.id);
      const done = await complete(d.id);
      const due = addWorkingDays(daysFromToday(-20), 6);
      expect(due < today()).toBe(true);
      expect(done.transferDueAt).toBe(due);
      expect(done.alerts).toEqual(['transferOverdue', 'unpaid']);
      expect(done.transferChecklist).not.toHaveProperty('taxiLicenseDetached');

      const list = ok<{ items: DealBody[]; total: number }>(
        await s.api.get('/api/deals?transferOverdue=true&pageSize=200'),
      );
      expect(list.items.map((i) => i.id)).toContain(d.id);
      expect(list.items.every((i) => i.alerts.includes('transferOverdue'))).toBe(true);

      const all = {
        idCopies: true,
        vehicleLicenseSigned: true,
        liensChecked: true,
        finesChecked: true,
        transferFiled: true,
        newLicenseReceived: true,
        insuranceHandled: true,
      };
      const closed = ok<DealBody>(
        await s.api.patch(`/api/deals/${d.id}/transfer`).send({ checklist: all }),
      );
      expect(closed).toMatchObject({ transferStatus: 'DONE', alerts: ['unpaid'] });
      const after = ok<{ items: DealBody[] }>(
        await s.api.get('/api/deals?transferOverdue=true&pageSize=200'),
      );
      expect(after.items.map((i) => i.id)).not.toContain(d.id);
    });
  });

  describe('list', () => {
    it('filters by type, status, vehicle, counterparty, dates and q', async () => {
      const otherBuyer = await contact({
        firstName: 'רונית',
        lastName: 'לוי',
        phones: ['050-771-2345'],
      });
      const p = await purchase({ date: '2026-01-10' });
      const d = await sale(p.vehicleId, { counterpartyId: otherBuyer.id, date: '2026-01-20' });
      type List = { items: DealBody[]; total: number; page: number; pageSize: number };
      const list = async (q: string) => ok<List>(await s.api.get(`/api/deals?pageSize=200&${q}`));

      const byVehicle = await list(`vehicleId=${p.vehicleId}`);
      expect(byVehicle.items.map((i) => i.id)).toEqual([d.id, p.id]);
      expect(byVehicle.items[0]).toMatchObject({
        vehicle: { id: p.vehicleId, make: 'Mazda', model: '3', year: 2019 },
        counterparty: { id: otherBuyer.id, name: 'רונית לוי' },
        balanceDue: 59_000,
        alerts: ['disclosureMissing'],
      });
      expect((await list(`vehicleId=${p.vehicleId}&type=SALE`)).items.map((i) => i.id)).toEqual([
        d.id,
      ]);
      expect((await list(`counterpartyId=${otherBuyer.id}`)).items.map((i) => i.id)).toEqual([
        d.id,
      ]);
      expect((await list(`from=2026-01-15&to=2026-01-25&vehicleId=${p.vehicleId}`)).total).toBe(1);
      expect((await list('q=לוי')).items.map((i) => i.id)).toEqual([d.id]);
      expect((await list('q=050-771-2345')).items.map((i) => i.id)).toEqual([d.id]);
      expect((await list(`q=${d.dealNo}`)).items.map((i) => i.id)).toContain(d.id);
      const plate = (await vehicle(p.vehicleId)).plateNo;
      expect((await list(`q=${plate}`)).items.map((i) => i.id)).toEqual([d.id, p.id]);
      const drafts = await list('status=DRAFT,PENDING');
      expect(drafts.items.every((i) => ['DRAFT', 'PENDING'].includes(i.status))).toBe(true);
      const page = await s.api.get('/api/deals?pageSize=2&page=1&sort=price&order=asc').expect(200);
      expect(page.body).toMatchObject({ page: 1, pageSize: 2 });
      const prices = (page.body as List).items.map((i) => i.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
  });

  describe('P&L, expense rebill and licence income', () => {
    let lease: LeaseBody;
    let taxiId: string;
    let licenseId: string;
    let bought: DealBody;
    let repair: ExpenseBody;
    let parts: ExpenseBody;

    beforeAll(async () => {
      bought = await purchase({
        price: 60_000,
        date: daysFromToday(-90),
        vehicle: inline({
          make: 'Toyota',
          model: 'Corolla',
          year: 2022,
          isTaxi: true,
          listingPrice: 80_000,
        }),
      });
      taxiId = bought.vehicleId;
      licenseId = (await f.license({ acquisitionPrice: 200_000, acquiredAt: '2024-01-15' })).id;
      lease = await f.activeLease({
        vehicleId: taxiId,
        taxiLicenseId: licenseId,
        startDate: daysFromToday(-60),
        monthlyRent: 6000,
      });
    });

    async function expense(body: Record<string, unknown>): Promise<ExpenseBody> {
      return ok(await s.api.post(`/api/vehicles/${taxiId}/expenses`).send(body), 201);
    }

    async function ledger(): Promise<LedgerEntryBody[]> {
      return (await f.ledger(lease.driverId)).items;
    }

    /** Non-void charges - credits attributed to the taxi, without rebilled expenses. */
    async function leaseIncomeOf(from: string, to: string | null): Promise<number> {
      const rebilled = new Set([repair.rebilledEntryId, parts.rebilledEntryId]);
      return sumMoney(
        (await ledger())
          .filter(
            (e) =>
              e.vehicleId === taxiId &&
              !e.voidedAt &&
              !rebilled.has(e.id) &&
              e.date >= from &&
              (to === null || e.date <= to) &&
              (e.type === 'CHARGE' || e.type === 'CREDIT'),
          )
          .map((e) => (e.type === 'CREDIT' ? -e.amount : e.amount)),
      );
    }

    it('rebills an expense to the driver of the segment (FIFO), once', async () => {
      repair = await expense({
        category: 'REPAIR',
        date: daysFromToday(-50),
        amount: 1180,
        vatReclaimable: true,
        description: 'החלפת רפידות',
      });
      const before = await f.ledger(lease.driverId);
      const res = ok<ExpenseBody>(await s.api.post(`/api/expenses/${repair.id}/rebill`).send({}));
      expect(res.rebilledEntryId).not.toBeNull();
      repair = res;
      const charge = (await ledger()).find((e) => e.id === res.rebilledEntryId);
      expect(charge).toMatchObject({
        type: 'CHARGE',
        chargeKind: 'REPAIR',
        amount: 1180,
        date: today(),
        dueDate: today(),
        contractId: lease.id,
        vehicleId: taxiId,
        taxiLicenseId: licenseId,
        description: 'החלפת רפידות',
        remaining: 1180,
      });
      expect((await f.ledger(lease.driverId)).balance).toBe(sumMoney([before.balance, 1180]));
      expectError(
        await s.api.post(`/api/expenses/${repair.id}/rebill`).send({}),
        409,
        'errors.alreadyRebilled',
      );
      expectError(await s.api.post('/api/expenses/nope/rebill'), 404, 'errors.notFound');
    });

    it('needs a matched driver (or driverId) and an expense paid by us', async () => {
      parts = await expense({ category: 'PARTS', date: daysFromToday(-80), amount: 300 });
      expectError(
        await s.api.post(`/api/expenses/${parts.id}/rebill`),
        409,
        'errors.noDriverMatched',
      );
      expectError(
        await s.api.post(`/api/expenses/${parts.id}/rebill`).send({ driverId: 'nope' }),
        404,
        'errors.notFound',
        [{ path: 'driverId', message: 'errors.notFound' }],
      );
      parts = ok<ExpenseBody>(
        await s.api
          .post(`/api/expenses/${parts.id}/rebill`)
          .send({ driverId: lease.driverId, date: daysFromToday(-1), description: 'מגבים' }),
      );
      const charge = (await ledger()).find((e) => e.id === parts.rebilledEntryId);
      expect(charge).toMatchObject({
        chargeKind: 'REPAIR',
        amount: 300,
        date: daysFromToday(-1),
        contractId: null,
        taxiLicenseId: null,
        vehicleId: taxiId,
        description: 'מגבים',
      });
      const theirs = await expense({
        category: 'TEST',
        date: daysFromToday(-10),
        amount: 500,
        paidBy: 'DRIVER',
      });
      expectError(
        await s.api.post(`/api/expenses/${theirs.id}/rebill`),
        409,
        'errors.invalidTransition',
      );
      // A rebilled expense keeps its amount.
      expectError(
        await s.api.patch(`/api/expenses/${repair.id}`).send({ amount: 1000 }),
        409,
        'errors.expenseRebilled',
      );
    });

    it('vehicle P&L: open cycle unrealised at the listing price, with lease income', async () => {
      ok(
        await s.api.post('/api/ledger/charges').send({
          driverId: lease.driverId,
          contractId: lease.id,
          chargeKind: 'DAMAGE',
          amount: 500,
          date: daysFromToday(-5),
        }),
        201,
      );
      const leaseIncome = await leaseIncomeOf(daysFromToday(-90), null);
      expect(leaseIncome).toBeGreaterThanOrEqual(6000 + 500);
      const pnl = ok<VehiclePnlBody>(await s.api.get(`/api/vehicles/${taxiId}/pnl`));
      expect(pnl.cycles).toHaveLength(1);
      const vat = vatOnMargin(80_000, 60_000, 18);
      const revenue = sumMoney([80_000, leaseIncome, 1180, 300]);
      const costs = sumMoney([60_000, 1000, 300, vat]);
      expect(pnl.cycles[0]).toEqual({
        id: bought.cycleId,
        kind: 'OWNED',
        startedAt: daysFromToday(-90),
        endedAt: null,
        endReason: null,
        open: true,
        purchasePrice: 60_000,
        salePrice: null,
        listingPrice: 80_000,
        commission: null,
        revenue: { sale: 80_000, commission: 0, leaseIncome, rebilled: 1480, total: revenue },
        costs: { purchase: 60_000, expenses: 1300, vatOnMargin: vat, total: costs },
        profit: sumMoney([revenue, -costs]),
        unrealised: true,
      });
      expect(pnl.totals).toEqual({ revenue, costs, profit: sumMoney([revenue, -costs]) });
      expectError(await s.api.get('/api/vehicles/nope/pnl'), 404, 'errors.notFound');
    });

    it('vehicle P&L after the sale (closed cycle) and a buy-back (second, open cycle)', async () => {
      ok(
        await s.api
          .post(`/api/leases/${lease.id}/end`)
          .send({ actualEndDate: today(), reason: 'TERMINATED_BY_US' }),
      );
      const d = await sale(taxiId, { price: 75_000 });
      await sign(d.id);
      await complete(d.id);
      const back = await purchase({
        vehicle: { id: taxiId },
        price: 70_000,
        date: daysFromToday(1),
      });

      const leaseIncome = await leaseIncomeOf(daysFromToday(-90), today());
      const pnl = ok<VehiclePnlBody>(await s.api.get(`/api/vehicles/${taxiId}/pnl`));
      expect(pnl.cycles.map((c) => c.id)).toEqual([back.cycleId, bought.cycleId]);
      const [open, sold] = pnl.cycles as [CyclePnlBody, CyclePnlBody];
      const soldVat = vatOnMargin(75_000, 60_000, 18);
      const soldRevenue = sumMoney([75_000, leaseIncome, 1480]);
      const soldCosts = sumMoney([60_000, 1300, soldVat]);
      expect(sold).toMatchObject({
        open: false,
        unrealised: false,
        endedAt: today(),
        salePrice: 75_000,
        revenue: { sale: 75_000, leaseIncome, rebilled: 1480, total: soldRevenue },
        costs: { purchase: 60_000, expenses: 1300, vatOnMargin: soldVat, total: soldCosts },
        profit: sumMoney([soldRevenue, -soldCosts]),
      });
      const openVat = vatOnMargin(80_000, 70_000, 18);
      expect(open).toMatchObject({
        open: true,
        unrealised: true,
        purchasePrice: 70_000,
        revenue: { sale: 80_000, leaseIncome: 0, rebilled: 0, total: 80_000 },
        costs: { purchase: 70_000, expenses: 0, vatOnMargin: openVat },
        profit: sumMoney([80_000, -70_000, -openVat]),
      });
      expect(pnl.totals).toEqual({
        revenue: sumMoney([open.revenue.total, sold.revenue.total]),
        costs: sumMoney([open.costs.total, sold.costs.total]),
        profit: sumMoney([open.profit, sold.profit]),
      });
    });

    it('licence P&L: rent and other income per year, rebilled expenses excluded', async () => {
      const entries = (await ledger()).filter(
        (e) => e.taxiLicenseId === licenseId && (e.type === 'CHARGE' || e.type === 'CREDIT'),
      );
      const years = [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))].sort();
      const byYear = years.map((year) => {
        const of = entries.filter(
          (e) => Number(e.date.slice(0, 4)) === year && e.id !== repair.rebilledEntryId,
        );
        return {
          year,
          rentIncome: sumMoney(
            of
              .filter((e) => e.type === 'CREDIT' || e.chargeKind === 'RENT')
              .map((e) => (e.type === 'CREDIT' ? -e.amount : e.amount)),
          ),
          otherIncome: sumMoney(
            of.filter((e) => e.type === 'CHARGE' && e.chargeKind !== 'RENT').map((e) => e.amount),
          ),
        };
      });
      const totalIncome = sumMoney(byYear.flatMap((y) => [y.rentIncome, y.otherIncome]));
      const pnl = ok<Record<string, unknown>>(
        await s.api.get(`/api/taxi-licenses/${licenseId}/pnl`),
      );
      expect(pnl).toEqual({
        acquisitionPrice: 200_000,
        salePrice: null,
        acquiredAt: '2024-01-15',
        soldAt: null,
        byYear,
        totalIncome,
        net: sumMoney([totalIncome, -200_000]),
      });
      expect(sumMoney(byYear.map((y) => y.otherIncome))).toBe(500);
      expect(sumMoney(byYear.map((y) => y.rentIncome))).toBeGreaterThanOrEqual(6000);
      expectError(await s.api.get('/api/taxi-licenses/nope/pnl'), 404, 'errors.notFound');
    });
  });

  describe('dashboard', () => {
    it('KPIs agree with the lists and the P&L of the cycles closed this month', async () => {
      const kpis = ok<Record<string, number>>(await s.api.get('/api/dashboard/kpis'));
      const total = async (url: string) => ok<{ total: number }>(await s.api.get(url)).total;
      const balances = ok<{ items: { balance: number }[] }>(
        await s.api.get('/api/ledger/balances?pageSize=200'),
      );
      const period = periodOf(today());
      const vehicles = ok<{ items: { id: string }[] }>(
        await s.api.get('/api/vehicles?pageSize=200'),
      );
      const profits: number[] = [];
      for (const v of vehicles.items) {
        const pnl = ok<VehiclePnlBody>(await s.api.get(`/api/vehicles/${v.id}/pnl`));
        for (const c of pnl.cycles) {
          if (c.endedAt && periodOf(c.endedAt) === period) profits.push(c.profit);
        }
      }
      expect(profits.length).toBeGreaterThan(0);
      expect(kpis).toMatchObject({
        vehiclesInStock: await total('/api/vehicles?status=IN_STOCK&pageSize=1'),
        activeLeases: await total('/api/leases?status=ACTIVE&pageSize=1'),
        receivables: sumMoney(balances.items.filter((b) => b.balance > 0).map((b) => b.balance)),
        monthProfit: sumMoney(profits),
        openDeals: await total('/api/deals?status=DRAFT,PENDING&pageSize=1'),
        transfersOverdue: await total('/api/deals?transferOverdue=true&pageSize=1'),
      });
      expect(kpis.transfersOverdue).toBeGreaterThan(0);
      // Milestone 5 additions (shared DashboardKpisSchema).
      expect(DashboardKpisSchema.safeParse(kpis).success).toBe(true);
    });
  });
});
