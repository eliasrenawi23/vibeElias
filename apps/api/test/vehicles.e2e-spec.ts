import { addMonths } from '@renawi/shared';
import request from 'supertest';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

/* Response shapes used by the assertions (wire form: numbers and YYYY-MM-DD strings). */
interface CycleBody {
  id: string;
  kind: 'OWNED' | 'CONSIGNED';
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  consignor: { id: string; name: string } | null;
  expenseTotal: number;
  expensePaidByUs: number;
  [key: string]: unknown;
}
interface VehicleBody {
  id: string;
  plateNo: string;
  status: string;
  ownership: string;
  currentKm: number | null;
  listingPrice: number | null;
  registeredLicense: { id: string; licenseNo: string } | null;
  ownerDriver: { id: string; name: string } | null;
  openCycle: { id: string; kind: string; startedAt: string } | null;
  alerts: string[];
  cycles: CycleBody[];
  insurance: { id: string }[];
  odometer: { km: number; date: string }[];
  expenseSummary: {
    cycleId: string | null;
    total: number;
    paidByUs: number;
    count: number;
    byCategory: { category: string; total: number }[];
  };
  documentCount: number;
  [key: string]: unknown;
}

describe('Vehicles (e2e)', () => {
  let s: Session;
  let plateSeq = 4_100_000;

  beforeAll(async () => {
    s = await startSession();
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  /** Unique 7-digit plate, sent in the dashed display format. */
  function nextPlate(): string {
    plateSeq += 7;
    const p = String(plateSeq);
    return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  }

  async function createVehicle(body: Record<string, unknown> = {}): Promise<VehicleBody> {
    const res = await s.api
      .post('/api/vehicles')
      .send({ plateNo: nextPlate(), make: 'Toyota', model: 'Corolla', year: 2022, ...body });
    expect({ status: res.status, body: res.status === 201 ? 'ok' : res.body }).toEqual({
      status: 201,
      body: 'ok',
    });
    return res.body as VehicleBody;
  }

  async function getVehicle(id: string): Promise<VehicleBody> {
    return (await s.api.get(`/api/vehicles/${id}`).expect(200)).body as VehicleBody;
  }

  async function createContact(body: Record<string, unknown>): Promise<{ id: string }> {
    return (await s.api.post('/api/contacts').send(body).expect(201)).body as { id: string };
  }

  async function createDriver(firstName: string, lastName: string) {
    const contact = await s.t.prisma.contact.create({
      data: { firstName, lastName, tags: ['DRIVER'] },
    });
    return s.t.prisma.driver.create({ data: { contactId: contact.id } });
  }

  let licenseSeq = 50_000;
  /** Driver + taxi licence + ACTIVE lease with an open segment holding the vehicle. */
  async function putOnLease(vehicleId: string) {
    const driver = await createDriver('Lease', 'Driver');
    licenseSeq += 1;
    const license = await s.t.prisma.taxiLicense.create({
      data: { licenseNo: String(licenseSeq) },
    });
    const contract = await s.t.prisma.leaseContract.create({
      data: {
        driverId: driver.id,
        type: 'CAR_AND_NUMBER',
        status: 'ACTIVE',
        startDate: new Date(`${daysFromToday(-30)}T00:00:00.000Z`),
        endDate: new Date(`${daysFromToday(335)}T00:00:00.000Z`),
        responsibilities: {
          insurance: 'DRIVER',
          test: 'DRIVER',
          repairs: 'DRIVER',
          fines: 'DRIVER',
        },
      },
    });
    const segment = await s.t.prisma.leaseSegment.create({
      data: {
        contractId: contract.id,
        taxiLicenseId: license.id,
        vehicleId,
        monthlyRent: 6000,
        startDate: new Date(`${daysFromToday(-30)}T00:00:00.000Z`),
      },
    });
    return { driver, license, contract, segment };
  }

  it('requires authentication', async () => {
    await request(s.t.http).get('/api/vehicles').expect(401);
    await request(s.t.http).post('/api/vehicles').send({}).expect(403); // no X-Requested-With
  });

  /* -------------------------------------------------------------------------------------- */
  /* List: filters, search, alerts (runs first so the totals below are exact)               */
  /* -------------------------------------------------------------------------------------- */

  describe('list filters and alerts', () => {
    let oldTaxi: VehicleBody;
    let tenYearTaxi: VehicleBody;
    let expiringSoon: VehicleBody;
    let expired: VehicleBody;
    let dealer11: VehicleBody;
    let consigned: VehicleBody;
    let licenseId: string;

    beforeAll(async () => {
      oldTaxi = await createVehicle({
        plateNo: '31-245-626',
        make: 'Skoda',
        model: 'Octavia',
        year: 2014,
        isTaxi: true,
        vin: 'TMBJG7NE5E0123987',
      });
      tenYearTaxi = await createVehicle({
        make: 'Hyundai',
        model: 'Ioniq',
        year: 2016,
        isTaxi: true,
        status: 'LEASED',
      });
      expiringSoon = await createVehicle({
        make: 'Kia',
        model: 'Sportage',
        year: 2021,
        registrationExpiry: daysFromToday(10),
      });
      expired = await createVehicle({
        make: 'kia',
        model: 'Picanto',
        year: 2019,
        registrationExpiry: daysFromToday(-1),
        status: 'RESERVED',
      });
      dealer11 = await createVehicle({
        make: 'Mazda',
        model: '3',
        year: 2019,
        dealerRegisteredAt: addMonths(today(), -11),
      });
      consigned = await createVehicle({
        make: 'Mazda',
        model: 'CX-5',
        year: 2020,
        ownership: 'CONSIGNED',
      });
      const license = await s.t.prisma.taxiLicense.create({
        data: { licenseNo: '24718', registeredVehicleId: oldTaxi.id },
      });
      licenseId = license.id;
    });

    async function list(query: string) {
      const res = await s.api.get(`/api/vehicles?${query}`).expect(200);
      return res.body as { items: VehicleBody[]; total: number; page: number; pageSize: number };
    }
    const ids = (items: VehicleBody[]) => items.map((v) => v.id).sort();

    it('returns the list item shape with refs, open cycle and computed alerts', async () => {
      const body = await list('pageSize=200');
      expect(body).toMatchObject({ total: 6, page: 1, pageSize: 200 });
      const byId = new Map(body.items.map((v) => [v.id, v]));

      expect(byId.get(oldTaxi.id)).toMatchObject({
        plateNo: '31245626',
        registeredLicense: { id: licenseId, licenseNo: '24718' },
        ownerDriver: null,
        openCycle: { id: expect.any(String), kind: 'OWNED', startedAt: today() },
      });
      expect(byId.get(oldTaxi.id)?.alerts).toEqual(
        expect.arrayContaining(['taxiAge10', 'taxiAgeBlocked']),
      );
      expect(byId.get(tenYearTaxi.id)?.alerts).toContain('taxiAge10');
      expect(byId.get(tenYearTaxi.id)?.alerts).not.toContain('taxiAgeBlocked');
      expect(byId.get(expiringSoon.id)?.alerts).toEqual(['registrationExpiring']);
      expect(byId.get(expired.id)?.alerts).toEqual(['registrationExpired']);
      expect(byId.get(dealer11.id)?.alerts).toEqual(['dealerRegistration11Months']);
      // Not a taxi, no dates: no alerts. CONSIGNED without /consign has no cycle.
      expect(byId.get(consigned.id)).toMatchObject({ alerts: [], openCycle: null });
    });

    it('uses Settings.reminderLeadDays.registration for "expiring"', async () => {
      await s.api
        .patch('/api/settings')
        .send({ reminderLeadDays: { registration: 5 } })
        .expect(200);
      expect((await getVehicle(expiringSoon.id)).alerts).toEqual([]);
      await s.api
        .patch('/api/settings')
        .send({ reminderLeadDays: { registration: 10 } })
        .expect(200);
      expect((await getVehicle(expiringSoon.id)).alerts).toEqual(['registrationExpiring']);
      await s.api
        .patch('/api/settings')
        .send({ reminderLeadDays: { registration: 30 } })
        .expect(200);
    });

    it('filters by status, ownership, isTaxi, make and year range', async () => {
      expect(ids((await list('status=LEASED')).items)).toEqual([tenYearTaxi.id]);
      expect((await list('status=IN_STOCK,RESERVED')).total).toBe(5);
      expect((await list('status=RESERVED&status=LEASED')).total).toBe(2);
      expect(ids((await list('ownership=CONSIGNED')).items)).toEqual([consigned.id]);
      expect(ids((await list('isTaxi=true')).items)).toEqual(ids([oldTaxi, tenYearTaxi]));
      expect((await list('isTaxi=false')).total).toBe(4);
      expect(ids((await list('make=KIA')).items)).toEqual(ids([expiringSoon, expired]));
      expect((await list('yearFrom=2019&yearTo=2020')).total).toBe(3);
      expect((await list('yearFrom=2021')).total).toBe(1);
      // Reversed range is swapped.
      expect((await list('yearFrom=2016&yearTo=2014')).total).toBe(2);
      expect((await s.api.get('/api/vehicles?status=FLYING')).status).toBe(400);
    });

    it('searches plate (any format), VIN, make and model', async () => {
      expect(ids((await list('q=31-245-626')).items)).toEqual([oldTaxi.id]);
      expect(ids((await list('q=245%206')).items)).toEqual([oldTaxi.id]);
      expect(ids((await list('q=tmbjg7ne')).items)).toEqual([oldTaxi.id]);
      expect(ids((await list('q=octavia')).items)).toEqual([oldTaxi.id]);
      expect(ids((await list('q=mazda%20cx')).items)).toEqual([consigned.id]);
      expect((await list('q=nothing-like-this')).total).toBe(0);
    });

    it('paginates and sorts', async () => {
      const page1 = await list('sort=year&order=asc&page=1&pageSize=4');
      expect(page1).toMatchObject({ total: 6, page: 1, pageSize: 4 });
      expect(page1.items.map((v) => v.year)).toEqual([2014, 2016, 2019, 2019]);
      const page2 = await list('sort=year&order=asc&page=2&pageSize=4');
      expect(page2.items.map((v) => v.year)).toEqual([2020, 2021]);
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Create / update                                                                        */
  /* -------------------------------------------------------------------------------------- */

  describe('create and update', () => {
    it('creates an OWNED stock car with an OWNED cycle starting today and the detail shape', async () => {
      const res = await s.api
        .post('/api/vehicles')
        .send({
          plateNo: '123-45-678',
          vin: 'jtnb23he0p3-012345',
          make: 'Toyota',
          model: 'Corolla',
          trim: 'Hybrid Sun',
          year: 2023,
          fuel: 'HYBRID',
          listingPrice: 99_900.5,
          currentKm: 1200,
        })
        .expect(201);
      const v = res.body as VehicleBody;
      expect(v).toMatchObject({
        plateNo: '12345678',
        vin: 'JTNB23HE0P3012345',
        status: 'IN_STOCK',
        ownership: 'OWNED',
        isTaxi: false,
        listingPrice: 99_900.5,
        registeredLicense: null,
        ownerDriver: null,
        openCycle: { kind: 'OWNED', startedAt: today() },
        alerts: [],
        insurance: [],
        odometer: [],
        expenseSummary: { total: 0, paidByUs: 0, count: 0, byCategory: [] },
        documentCount: 0,
      });
      expect(v.cycles).toHaveLength(1);
      expect(v.cycles[0]).toMatchObject({
        id: v.openCycle?.id,
        kind: 'OWNED',
        startedAt: today(),
        endedAt: null,
        askingPrice: 99_900.5,
        expenseTotal: 0,
        consignor: null,
      });
      expect(v.expenseSummary.cycleId).toBe(v.openCycle?.id);

      const audit = await s.t.prisma.auditLog.findFirst({
        where: { entity: 'Vehicle', entityId: v.id, action: 'CREATE' },
      });
      expect(audit).not.toBeNull();
    });

    it('opens a cycle only for OWNED cars in IN_STOCK / RESERVED / LEASED', async () => {
      for (const status of ['RESERVED', 'LEASED'] as const) {
        expect((await createVehicle({ status })).openCycle).toMatchObject({ kind: 'OWNED' });
      }
      const external = await createVehicle({ status: 'EXTERNAL' });
      expect(external).toMatchObject({ openCycle: null, cycles: [] });
      const consigned = await createVehicle({ ownership: 'CONSIGNED' });
      expect(consigned).toMatchObject({ openCycle: null, cycles: [] });
    });

    it('THIRD_PARTY needs an existing owner driver and opens no cycle', async () => {
      const missing = await s.api.post('/api/vehicles').send({
        plateNo: nextPlate(),
        make: 'Kia',
        model: 'Niro',
        year: 2022,
        ownership: 'THIRD_PARTY',
      });
      expectError(missing, 400, 'errors.validation', [
        { path: 'ownerDriverId', message: 'validation.ownerDriverRequired' },
      ]);

      const unknown = await s.api.post('/api/vehicles').send({
        plateNo: nextPlate(),
        make: 'Kia',
        model: 'Niro',
        year: 2022,
        ownership: 'THIRD_PARTY',
        ownerDriverId: 'no-such-driver',
      });
      expectError(unknown, 404, 'errors.notFound', [
        { path: 'ownerDriverId', message: 'errors.notFound' },
      ]);

      const driver = await createDriver('אבי', 'מזרחי');
      const v = await createVehicle({
        make: 'Kia',
        model: 'Niro',
        isTaxi: true,
        status: 'EXTERNAL',
        ownership: 'THIRD_PARTY',
        ownerDriverId: driver.id,
      });
      expect(v).toMatchObject({
        ownerDriver: { id: driver.id, name: 'אבי מזרחי' },
        openCycle: null,
        cycles: [],
      });
    });

    it('rejects a duplicate plate (any format) or VIN with 409 validation.duplicate', async () => {
      const first = await createVehicle({ vin: 'KMHC851CGHU123456' });
      const dupPlate = await s.api
        .post('/api/vehicles')
        .send({ plateNo: first.plateNo, make: 'Kia', model: 'Rio', year: 2020 });
      expectError(dupPlate, 409, 'errors.conflict', [
        { path: 'plateNo', message: 'validation.duplicate' },
      ]);
      const formatted = `${first.plateNo.slice(0, 2)} ${first.plateNo.slice(2, 5)} ${first.plateNo.slice(5)}`;
      const dupFormatted = await s.api
        .post('/api/vehicles')
        .send({ plateNo: formatted, make: 'Kia', model: 'Rio', year: 2020 });
      expect(dupFormatted.status).toBe(409);
      const dupVin = await s.api.post('/api/vehicles').send({
        plateNo: nextPlate(),
        vin: 'kmhc851cghu123456',
        make: 'Kia',
        model: 'Rio',
        year: 2020,
      });
      expectError(dupVin, 409, 'errors.conflict', [
        { path: 'vin', message: 'validation.duplicate' },
      ]);

      const other = await createVehicle();
      const patchDup = await s.api
        .patch(`/api/vehicles/${other.id}`)
        .send({ plateNo: first.plateNo });
      expectError(patchDup, 409, 'errors.conflict', [
        { path: 'plateNo', message: 'validation.duplicate' },
      ]);
    });

    it('validates the body', async () => {
      const res = await s.api
        .post('/api/vehicles')
        .send({ plateNo: '12-34', make: '', model: 'X', year: 1900 });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('errors.validation');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          { path: 'plateNo', message: 'validation.invalidPlate' },
          { path: 'make', message: 'validation.required' },
        ]),
      );
    });

    it('PATCH updates fields; GET unknown -> 404', async () => {
      const v = await createVehicle();
      const res = await s.api
        .patch(`/api/vehicles/${v.id}`)
        .send({
          color: 'לבן',
          listingPrice: 45_000,
          registrationExpiry: daysFromToday(3),
          notes: '',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        color: 'לבן',
        listingPrice: 45_000,
        registrationExpiry: daysFromToday(3),
        notes: null,
        alerts: ['registrationExpiring'],
      });
      expectError(await s.api.get('/api/vehicles/nope'), 404, 'errors.notFound');
      expectError(
        await s.api.patch('/api/vehicles/nope').send({ color: 'x' }),
        404,
        'errors.notFound',
      );
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Status transitions                                                                     */
  /* -------------------------------------------------------------------------------------- */

  describe('POST /vehicles/:id/status', () => {
    const setStatus = (id: string, status: string, note?: string) =>
      s.api.post(`/api/vehicles/${id}/status`).send({ status, note });

    it('IN_STOCK <-> RESERVED, same status is a no-op, note is audited', async () => {
      const v = await createVehicle();
      const reserved = await setStatus(v.id, 'RESERVED', 'מקדמה התקבלה').expect(200);
      expect(reserved.body).toMatchObject({
        status: 'RESERVED',
        openCycle: { id: v.openCycle?.id },
      });
      await setStatus(v.id, 'RESERVED').expect(200);
      const back = await setStatus(v.id, 'IN_STOCK').expect(200);
      expect(back.body.status).toBe('IN_STOCK');

      const audits = await s.t.prisma.auditLog.findMany({
        where: { entity: 'Vehicle', entityId: v.id, action: 'UPDATE' },
      });
      expect(audits).toHaveLength(2);
      expect(JSON.stringify(audits.map((a) => a.diff))).toContain('מקדמה התקבלה');
    });

    it('rejects SOLD with errors.useDeal and other jumps with errors.invalidTransition', async () => {
      const v = await createVehicle();
      expectError(await setStatus(v.id, 'SOLD'), 409, 'errors.useDeal');
      expectError(await setStatus(v.id, 'LEASED'), 409, 'errors.invalidTransition');
      expectError(await setStatus(v.id, 'RETURNED'), 409, 'errors.invalidTransition');
      expectError(await setStatus(v.id, 'EXTERNAL'), 409, 'errors.invalidTransition');
      expect((await setStatus(v.id, 'FLYING')).status).toBe(400);
      expectError(await setStatus('nope', 'RESERVED'), 404, 'errors.notFound');
    });

    it('IN_STOCK -> SCRAPPED closes the open cycle; nothing leaves SCRAPPED', async () => {
      const v = await createVehicle();
      const res = await setStatus(v.id, 'SCRAPPED').expect(200);
      const body = res.body as VehicleBody;
      expect(body).toMatchObject({ status: 'SCRAPPED', openCycle: null, alerts: [] });
      expect(body.cycles[0]).toMatchObject({ endedAt: today(), endReason: 'SCRAPPED' });
      expectError(await setStatus(v.id, 'IN_STOCK'), 409, 'errors.invalidTransition');
    });

    it('LEASED -> IN_STOCK only without an open lease segment', async () => {
      const v = await createVehicle({ status: 'LEASED', isTaxi: true });
      const { segment } = await putOnLease(v.id);
      expectError(await setStatus(v.id, 'IN_STOCK'), 409, 'errors.vehicleLeased');
      expectError(await setStatus(v.id, 'RESERVED'), 409, 'errors.invalidTransition');

      await s.t.prisma.leaseSegment.update({
        where: { id: segment.id },
        data: { endDate: new Date(`${today()}T00:00:00.000Z`) },
      });
      const res = await setStatus(v.id, 'IN_STOCK').expect(200);
      expect(res.body).toMatchObject({ status: 'IN_STOCK', openCycle: { id: v.openCycle?.id } });
    });

    it('EXTERNAL -> IN_STOCK makes the car OWNED and opens an OWNED cycle', async () => {
      const driver = await createDriver('خالد', 'عودة');
      const v = await createVehicle({
        status: 'EXTERNAL',
        ownership: 'THIRD_PARTY',
        ownerDriverId: driver.id,
      });
      const res = await setStatus(v.id, 'IN_STOCK').expect(200);
      const body = res.body as VehicleBody;
      expect(body).toMatchObject({
        status: 'IN_STOCK',
        ownership: 'OWNED',
        ownerDriver: null,
        openCycle: { kind: 'OWNED', startedAt: today() },
      });
      expect(body.cycles).toHaveLength(1);
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Expenses                                                                               */
  /* -------------------------------------------------------------------------------------- */

  describe('expenses', () => {
    let v: VehicleBody;
    let garageId: string;

    beforeAll(async () => {
      v = await createVehicle({ make: 'Skoda', model: 'Superb' });
      garageId = (await createContact({ companyName: 'מוסך אבו סאלח', tags: ['GARAGE'] })).id;
    });

    const addExpense = (vehicleId: string, body: Record<string, unknown>) =>
      s.api.post(`/api/vehicles/${vehicleId}/expenses`).send(body);

    it('links a new expense to the open cycle and returns the vendor ref', async () => {
      const res = await addExpense(v.id, {
        category: 'REPAIR',
        date: daysFromToday(-3),
        amount: 1250.5,
        vendorId: garageId,
        description: 'החלפת רפידות',
      }).expect(201);
      expect(res.body).toMatchObject({
        vehicleId: v.id,
        cycleId: v.openCycle?.id,
        category: 'REPAIR',
        date: daysFromToday(-3),
        amount: 1250.5,
        vatIncluded: true,
        vatReclaimable: false,
        paidBy: 'US',
        vendor: { id: garageId, name: 'מוסך אבו סאלח' },
        rebilledEntryId: null,
      });
      const audit = await s.t.prisma.auditLog.findFirst({
        where: { entity: 'VehicleExpense', entityId: res.body.id, action: 'CREATE' },
      });
      expect(audit).not.toBeNull();
    });

    it('validates amount, vendor and cycle', async () => {
      const zero = await addExpense(v.id, { category: 'TEST', date: today(), amount: 0 });
      expectError(zero, 400, 'errors.validation', [
        { path: 'amount', message: 'validation.positive' },
      ]);
      const decimals = await addExpense(v.id, { category: 'TEST', date: today(), amount: 1.005 });
      expectError(decimals, 400, 'errors.validation', [
        { path: 'amount', message: 'validation.invalidAmount' },
      ]);
      const vendor = await addExpense(v.id, {
        category: 'TEST',
        date: today(),
        amount: 10,
        vendorId: 'nope',
      });
      expectError(vendor, 404, 'errors.notFound', [
        { path: 'vendorId', message: 'errors.notFound' },
      ]);
      const other = await createVehicle();
      const foreignCycle = await addExpense(v.id, {
        category: 'TEST',
        date: today(),
        amount: 10,
        cycleId: other.openCycle?.id,
      });
      expectError(foreignCycle, 400, 'errors.validation', [
        { path: 'cycleId', message: 'validation.invalidValue' },
      ]);
      expectError(
        await addExpense('nope', { category: 'TEST', date: today(), amount: 10 }),
        404,
        'errors.notFound',
      );
    });

    it('cycleId null keeps the expense off the cycle; no open cycle -> unlinked', async () => {
      const off = await addExpense(v.id, {
        category: 'FUEL',
        date: today(),
        amount: 200,
        cycleId: null,
      }).expect(201);
      expect(off.body.cycleId).toBeNull();
      const external = await createVehicle({ status: 'EXTERNAL' });
      const res = await addExpense(external.id, {
        category: 'TOWING',
        date: today(),
        amount: 350,
      }).expect(201);
      expect(res.body.cycleId).toBeNull();
    });

    it('lists newest first with total, filters by date range and category', async () => {
      await addExpense(v.id, {
        category: 'TEST',
        date: daysFromToday(-10),
        amount: 1100,
        paidBy: 'DRIVER',
      }).expect(201);
      await addExpense(v.id, { category: 'REPAIR', date: daysFromToday(-1), amount: 300 }).expect(
        201,
      );

      const all = await s.api.get(`/api/vehicles/${v.id}/expenses`).expect(200);
      const items = all.body.items as { date: string; amount: number; category: string }[];
      expect(items.map((e) => e.date)).toEqual([
        today(),
        daysFromToday(-1),
        daysFromToday(-3),
        daysFromToday(-10),
      ]);
      expect(all.body.total).toBe(2850.5);
      expect(all.body.summary).toMatchObject({
        total: 2850.5,
        paidByUs: 1750.5,
        count: 4,
        byCategory: [
          { category: 'REPAIR', total: 1550.5 },
          { category: 'TEST', total: 1100 },
          { category: 'FUEL', total: 200 },
        ],
      });

      const ranged = await s.api
        .get(`/api/vehicles/${v.id}/expenses?from=${daysFromToday(-5)}&to=${daysFromToday(-1)}`)
        .expect(200);
      expect(ranged.body.items).toHaveLength(2);
      expect(ranged.body.total).toBe(1550.5);

      const byCategory = await s.api
        .get(`/api/vehicles/${v.id}/expenses?category=TEST,FUEL`)
        .expect(200);
      expect(byCategory.body.total).toBe(1300);
      expectError(await s.api.get('/api/vehicles/nope/expenses'), 404, 'errors.notFound');
    });

    it('the vehicle file summarises the open cycle (cycle totals include every payer)', async () => {
      const detail = await getVehicle(v.id);
      expect(detail.expenseSummary).toMatchObject({
        cycleId: v.openCycle?.id,
        total: 2650.5,
        paidByUs: 1550.5,
        count: 3,
        byCategory: [
          { category: 'REPAIR', total: 1550.5 },
          { category: 'TEST', total: 1100 },
        ],
      });
      expect(detail.cycles[0]).toMatchObject({ expenseTotal: 2650.5, expensePaidByUs: 1550.5 });
    });

    it('PATCH updates and can unlink; DELETE removes', async () => {
      const created = await addExpense(v.id, {
        category: 'CLEANING',
        date: today(),
        amount: 80,
      }).expect(201);
      const id = created.body.id as string;
      const patched = await s.api
        .patch(`/api/expenses/${id}`)
        .send({ amount: 95, category: 'PARTS', cycleId: null, description: 'מגבים' })
        .expect(200);
      expect(patched.body).toMatchObject({
        amount: 95,
        category: 'PARTS',
        cycleId: null,
        description: 'מגבים',
      });
      const relinked = await s.api
        .patch(`/api/expenses/${id}`)
        .send({ cycleId: v.openCycle?.id })
        .expect(200);
      expect(relinked.body.cycleId).toBe(v.openCycle?.id);
      expect((await s.api.get(`/api/expenses/${id}`).expect(200)).body.amount).toBe(95);

      await s.api.del(`/api/expenses/${id}`).expect(204);
      expectError(await s.api.get(`/api/expenses/${id}`), 404, 'errors.notFound');
      expectError(await s.api.del(`/api/expenses/${id}`), 404, 'errors.notFound');
      expectError(
        await s.api.patch('/api/expenses/nope').send({ amount: 1 }),
        404,
        'errors.notFound',
      );
    });

    it('an expense already charged to a driver cannot be deleted or change amount', async () => {
      const created = await addExpense(v.id, {
        category: 'REPAIR',
        date: today(),
        amount: 500,
        paidBy: 'US',
      }).expect(201);
      const driver = await createDriver('رامي', 'حداد');
      const charge = await s.t.prisma.ledgerEntry.create({
        data: {
          driverId: driver.id,
          type: 'CHARGE',
          chargeKind: 'REPAIR',
          date: new Date(`${today()}T00:00:00.000Z`),
          amount: 500,
        },
      });
      await s.t.prisma.vehicleExpense.update({
        where: { id: created.body.id as string },
        data: { rebilledEntryId: charge.id },
      });

      expectError(
        await s.api.del(`/api/expenses/${created.body.id}`),
        409,
        'errors.expenseRebilled',
      );
      expectError(
        await s.api.patch(`/api/expenses/${created.body.id}`).send({ amount: 600 }),
        409,
        'errors.expenseRebilled',
      );
      const ok = await s.api
        .patch(`/api/expenses/${created.body.id}`)
        .send({ amount: 500, description: 'רפידות בלמים' })
        .expect(200);
      expect(ok.body.description).toBe('רפידות בלמים');
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Insurance                                                                              */
  /* -------------------------------------------------------------------------------------- */

  describe('insurance', () => {
    let v: VehicleBody;
    const vehiclePolicy = {
      type: 'COMPREHENSIVE',
      insurer: 'הראל',
      policyNo: 'CMP-1',
      startDate: daysFromToday(-100),
      endDate: daysFromToday(265),
      premium: 7400,
      hasTaxiExtension: true,
    };

    beforeAll(async () => {
      v = await createVehicle({ isTaxi: true });
    });

    it('adds VEHICLE-scope policies (taxi extension kept only on COMPREHENSIVE)', async () => {
      const res = await s.api
        .post(`/api/vehicles/${v.id}/insurance`)
        .send(vehiclePolicy)
        .expect(201);
      expect(res.body).toMatchObject({
        scope: 'VEHICLE',
        vehicleId: v.id,
        type: 'COMPREHENSIVE',
        premium: 7400,
        paidBy: 'US',
        hasTaxiExtension: true,
        startDate: daysFromToday(-100),
        endDate: daysFromToday(265),
      });
      const compulsory = await s.api
        .post(`/api/vehicles/${v.id}/insurance`)
        .send({
          ...vehiclePolicy,
          type: 'COMPULSORY',
          startDate: daysFromToday(-400),
          endDate: daysFromToday(-35),
        })
        .expect(201);
      expect(compulsory.body.hasTaxiExtension).toBe(false);

      const list = await s.api.get(`/api/vehicles/${v.id}/insurance`).expect(200);
      expect((list.body as { type: string }[]).map((p) => p.type)).toEqual([
        'COMPREHENSIVE',
        'COMPULSORY',
      ]);
      expect((await getVehicle(v.id)).insurance).toHaveLength(2);
      expectError(await s.api.get('/api/vehicles/nope/insurance'), 404, 'errors.notFound');
    });

    it('requires endDate after startDate (validation.endAfterStart)', async () => {
      for (const endDate of [vehiclePolicy.startDate, daysFromToday(-101)]) {
        const res = await s.api
          .post(`/api/vehicles/${v.id}/insurance`)
          .send({ ...vehiclePolicy, endDate });
        expectError(res, 400, 'errors.validation', [
          { path: 'endDate', message: 'validation.endAfterStart' },
        ]);
      }
      const business = await s.api.post('/api/insurance').send({
        type: 'TRADE',
        insurer: 'מנורה',
        startDate: today(),
        endDate: today(),
      });
      expectError(business, 400, 'errors.validation', [
        { path: 'endDate', message: 'validation.endAfterStart' },
      ]);
    });

    it('keeps TRADE / LOT policies at business level', async () => {
      const onVehicle = await s.api
        .post(`/api/vehicles/${v.id}/insurance`)
        .send({ ...vehiclePolicy, type: 'TRADE' });
      expectError(onVehicle, 400, 'errors.validation', [
        { path: 'scope', message: 'validation.businessPolicyType' },
      ]);

      const created = await s.api
        .post('/api/insurance')
        .send({
          type: 'TRADE',
          insurer: 'מנורה',
          policyNo: 'TRD-9',
          startDate: daysFromToday(-30),
          endDate: daysFromToday(335),
          premium: 12_000,
        })
        .expect(201);
      expect(created.body).toMatchObject({ scope: 'BUSINESS', vehicleId: null, type: 'TRADE' });

      const withVehicle = await s.api.post('/api/insurance').send({
        type: 'LOT',
        insurer: 'מנורה',
        startDate: today(),
        endDate: daysFromToday(365),
        vehicleId: v.id,
      });
      expectError(withVehicle, 400, 'errors.validation', [
        { path: 'vehicleId', message: 'validation.businessScopeNoVehicle' },
      ]);
      const wrongType = await s.api.post('/api/insurance').send({
        type: 'COMPULSORY',
        insurer: 'מנורה',
        startDate: today(),
        endDate: daysFromToday(365),
      });
      expectError(wrongType, 400, 'errors.validation', [
        { path: 'type', message: 'validation.invalidOption' },
      ]);
    });

    it('GET /insurance filters by scope and activeOnly, items carry the vehicle ref', async () => {
      await s.api
        .post('/api/insurance')
        .send({
          type: 'LOT',
          insurer: 'כלל',
          startDate: daysFromToday(10),
          endDate: daysFromToday(375),
        })
        .expect(201);

      const business = await s.api.get('/api/insurance?scope=BUSINESS').expect(200);
      expect((business.body as { type: string }[]).map((p) => p.type)).toEqual(['LOT', 'TRADE']);
      const activeBusiness = await s.api
        .get('/api/insurance?scope=BUSINESS&activeOnly=true')
        .expect(200);
      expect((activeBusiness.body as { type: string }[]).map((p) => p.type)).toEqual(['TRADE']);

      const vehicleScope = await s.api.get('/api/insurance?scope=VEHICLE').expect(200);
      expect(vehicleScope.body).toHaveLength(2);
      expect(vehicleScope.body[0].vehicle).toEqual({
        id: v.id,
        plateNo: v.plateNo,
        make: 'Toyota',
        model: 'Corolla',
      });
      const active = await s.api.get('/api/insurance?activeOnly=true').expect(200);
      expect((active.body as { type: string }[]).map((p) => p.type).sort()).toEqual([
        'COMPREHENSIVE',
        'TRADE',
      ]);
    });

    it('PATCH validates the merged dates; scope is fixed; DELETE removes', async () => {
      const created = await s.api
        .post(`/api/vehicles/${v.id}/insurance`)
        .send({ ...vehiclePolicy, type: 'THIRD_PARTY', hasTaxiExtension: false })
        .expect(201);
      const id = created.body.id as string;

      const badEnd = await s.api
        .patch(`/api/insurance/${id}`)
        .send({ endDate: daysFromToday(-150) });
      expectError(badEnd, 400, 'errors.validation', [
        { path: 'endDate', message: 'validation.endAfterStart' },
      ]);
      const scope = await s.api.patch(`/api/insurance/${id}`).send({ scope: 'BUSINESS' });
      expect(scope.status).toBe(400);

      const ok = await s.api
        .patch(`/api/insurance/${id}`)
        .send({ insurer: 'מגדל', premium: 3100, endDate: daysFromToday(200) })
        .expect(200);
      expect(ok.body).toMatchObject({
        insurer: 'מגדל',
        premium: 3100,
        endDate: daysFromToday(200),
      });

      await s.api.del(`/api/insurance/${id}`).expect(204);
      expectError(await s.api.get(`/api/insurance/${id}`), 404, 'errors.notFound');
      expectError(await s.api.del(`/api/insurance/${id}`), 404, 'errors.notFound');
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Odometer                                                                               */
  /* -------------------------------------------------------------------------------------- */

  describe('odometer', () => {
    it('records readings; the latest by date becomes currentKm; readings never decrease', async () => {
      const v = await createVehicle({ currentKm: 50 });
      const add = (km: number, date: string, source?: string) =>
        s.api.post(`/api/vehicles/${v.id}/odometer`).send({ km, date, source });

      const first = await add(10_000, daysFromToday(-10), 'קנייה').expect(201);
      expect(first.body).toMatchObject({ vehicleId: v.id, km: 10_000, date: daysFromToday(-10) });
      expect((await getVehicle(v.id)).currentKm).toBe(10_000);

      await add(15_000, today(), 'טסט').expect(201);
      expect((await getVehicle(v.id)).currentKm).toBe(15_000);

      // Back-dated reading between the two: accepted, currentKm stays at the latest reading.
      await add(12_000, daysFromToday(-5)).expect(201);
      expect((await getVehicle(v.id)).currentKm).toBe(15_000);

      // Lower than an earlier reading / higher than a later one.
      expectError(await add(11_000, daysFromToday(-2)), 400, 'errors.validation', [
        { path: 'km', message: 'validation.odometerDecreasing' },
      ]);
      expectError(await add(13_000, daysFromToday(-20)), 400, 'errors.validation', [
        { path: 'km', message: 'validation.odometerDecreasing' },
      ]);
      expect((await add(-1, today())).status).toBe(400);
      expectError(
        await s.api.post('/api/vehicles/nope/odometer').send({ km: 1, date: today() }),
        404,
        'errors.notFound',
      );

      const list = await s.api.get(`/api/vehicles/${v.id}/odometer`).expect(200);
      expect((list.body as { km: number }[]).map((r) => r.km)).toEqual([15_000, 12_000, 10_000]);
      const ranged = await s.api
        .get(`/api/vehicles/${v.id}/odometer?from=${daysFromToday(-6)}&to=${daysFromToday(-1)}`)
        .expect(200);
      expect((ranged.body as { km: number }[]).map((r) => r.km)).toEqual([12_000]);
    });

    it('the vehicle file shows the last 20 readings, newest first', async () => {
      const v = await createVehicle();
      await s.t.prisma.odometerLog.createMany({
        data: Array.from({ length: 22 }, (_, i) => ({
          vehicleId: v.id,
          km: 1000 * (i + 1),
          date: new Date(`${daysFromToday(i - 30)}T00:00:00.000Z`),
        })),
      });
      const detail = await getVehicle(v.id);
      expect(detail.odometer).toHaveLength(20);
      expect(detail.odometer[0]).toMatchObject({ km: 22_000, date: daysFromToday(-9) });
      expect(detail.odometer[19]?.km).toBe(3000);
    });
  });

  /* -------------------------------------------------------------------------------------- */
  /* Consignment cycles                                                                     */
  /* -------------------------------------------------------------------------------------- */

  describe('consignment: consign -> return', () => {
    let consignorId: string;
    const terms = {
      askingPrice: 132_000,
      minNetToConsignor: 120_000,
      commissionMode: 'PERCENT',
      commissionValue: 5,
      agreementEndsAt: daysFromToday(90),
    };

    beforeAll(async () => {
      consignorId = (await createContact({ firstName: 'سامر', lastName: 'نصار', tags: ['SELLER'] }))
        .id;
    });

    const consign = (vehicleId: string, body: Record<string, unknown>) =>
      s.api.post(`/api/vehicles/${vehicleId}/consign`).send(body);

    it('opens a CONSIGNED cycle, makes the car CONSIGNED / IN_STOCK and tags the consignor', async () => {
      const v = await createVehicle({ make: 'Toyota', model: 'RAV4', status: 'EXTERNAL' });
      const res = await consign(v.id, { consignorId, ...terms }).expect(200);
      const body = res.body as VehicleBody;
      expect(body).toMatchObject({
        ownership: 'CONSIGNED',
        status: 'IN_STOCK',
        listingPrice: 132_000,
        openCycle: { kind: 'CONSIGNED', startedAt: today() },
      });
      expect(body.cycles).toHaveLength(1);
      expect(body.cycles[0]).toMatchObject({
        kind: 'CONSIGNED',
        consignor: { id: consignorId, name: 'سامر نصار' },
        askingPrice: 132_000,
        minNetToConsignor: 120_000,
        commissionMode: 'PERCENT',
        commissionValue: 5,
        agreementEndsAt: daysFromToday(90),
        endedAt: null,
      });
      const contact = await s.api.get(`/api/contacts/${consignorId}`).expect(200);
      expect(contact.body.tags).toEqual(['SELLER', 'CONSIGNOR']);

      const cycles = await s.api.get(`/api/vehicles/${v.id}/cycles`).expect(200);
      expect(cycles.body).toHaveLength(1);

      // A second intake while the cycle is open.
      expectError(await consign(v.id, { consignorId, ...terms }), 409, 'errors.cycleOpen');
    });

    it('409 errors.cycleOpen for a car in our stock; validates the consignor and terms', async () => {
      const owned = await createVehicle();
      expectError(await consign(owned.id, { consignorId, ...terms }), 409, 'errors.cycleOpen');

      const v = await createVehicle({ status: 'EXTERNAL' });
      expectError(await consign(v.id, { ...terms, consignorId: 'nope' }), 404, 'errors.notFound', [
        { path: 'consignorId', message: 'errors.notFound' },
      ]);
      const surplus = await consign(v.id, {
        consignorId,
        askingPrice: 50_000,
        commissionMode: 'SURPLUS',
      });
      expectError(surplus, 400, 'errors.validation', [
        { path: 'minNetToConsignor', message: 'validation.minNetRequired' },
      ]);
      expectError(await consign('nope', { consignorId, ...terms }), 404, 'errors.notFound');
    });

    it('returns the car: cycle ends RETURNED_TO_CONSIGNOR, vehicle RETURNED; then 409s', async () => {
      const v = await createVehicle({ status: 'EXTERNAL' });
      const consigned = (
        await consign(v.id, {
          consignorId,
          ...terms,
          startedAt: daysFromToday(-20),
        }).expect(200)
      ).body as VehicleBody;
      const cycleId = consigned.openCycle?.id as string;

      expectError(
        await s.api.post(`/api/cycles/${cycleId}/return`).send({ date: daysFromToday(-21) }),
        400,
        'errors.validation',
        [{ path: 'date', message: 'validation.endBeforeStart' }],
      );

      const res = await s.api
        .post(`/api/cycles/${cycleId}/return`)
        .send({ note: 'הבעלים החליט למכור בעצמו' })
        .expect(200);
      const body = res.body as VehicleBody;
      expect(body).toMatchObject({ status: 'RETURNED', ownership: 'CONSIGNED', openCycle: null });
      expect(body.cycles[0]).toMatchObject({
        id: cycleId,
        endedAt: today(),
        endReason: 'RETURNED_TO_CONSIGNOR',
      });

      expectError(await s.api.post(`/api/cycles/${cycleId}/return`), 409, 'errors.noOpenCycle');
      expectError(await s.api.post('/api/cycles/nope/return'), 404, 'errors.notFound');

      // An OWNED cycle is not returned to a consignor.
      const owned = await createVehicle();
      expectError(
        await s.api.post(`/api/cycles/${owned.openCycle?.id}/return`).send({}),
        409,
        'errors.noOpenCycle',
      );

      // The returned car can come back on a new consignment (second cycle, newest first).
      const again = await consign(v.id, { consignorId, ...terms }).expect(200);
      const cycles = (await s.api.get(`/api/vehicles/${v.id}/cycles`).expect(200))
        .body as CycleBody[];
      expect(cycles.map((c) => c.id)).toEqual([again.body.openCycle.id, cycleId]);
    });

    it('a draft / pending deal on the cycle blocks the return', async () => {
      const v = await createVehicle({ status: 'EXTERNAL' });
      const consigned = (await consign(v.id, { consignorId, ...terms }).expect(200))
        .body as VehicleBody;
      const buyer = await createContact({ firstName: 'רונית', lastName: 'לוי', tags: ['BUYER'] });
      await s.t.prisma.deal.create({
        data: {
          type: 'CONSIGNMENT_SALE',
          status: 'PENDING',
          vehicleId: v.id,
          cycleId: consigned.openCycle?.id,
          counterpartyId: buyer.id,
          date: new Date(`${today()}T00:00:00.000Z`),
          price: 128_000,
          vatRate: 18,
        },
      });
      expectError(
        await s.api.post(`/api/cycles/${consigned.openCycle?.id}/return`),
        409,
        'errors.dealPending',
      );
    });

    it('a car on an open lease segment cannot be consigned', async () => {
      const v = await createVehicle({ status: 'EXTERNAL', isTaxi: true });
      await putOnLease(v.id);
      expectError(await consign(v.id, { consignorId, ...terms }), 409, 'errors.vehicleLeased');
    });
  });
});
