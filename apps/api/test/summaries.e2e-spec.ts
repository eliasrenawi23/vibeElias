import { DealStatus, FineStatus, LeaseStatus, VehicleStatus } from '@renawi/shared';
import request from 'supertest';
import { Factory, LeaseBody } from './factories';
import { daysFromToday, Session, startSession, today } from './helpers';

interface Summary {
  counts: Record<string, number>;
}
interface Ref {
  id: string;
}

describe('Status summaries (e2e)', () => {
  let s: Session;
  let f: Factory;
  let leaseA: LeaseBody;
  let leaseB: LeaseBody;
  let draftLease: LeaseBody;
  let stockId: string;
  let saleVehicleId: string;
  let buyerId: string;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 8);

    // Vehicles: 2 non-taxi IN_STOCK (Mazda 2019 + Kia 2021), 1 non-taxi RESERVED.
    const mk = async (body: Record<string, unknown>): Promise<Ref> =>
      (
        await s.api
          .post('/api/vehicles')
          .send({
            plateNo: f.nextPlate(),
            make: 'Mazda',
            model: '3',
            year: 2019,
            isTaxi: false,
            ...body,
          })
          .expect(201)
      ).body as Ref;
    stockId = (await mk({})).id;
    saleVehicleId = (await mk({ make: 'Kia', year: 2021 })).id;
    await mk({ status: 'RESERVED' });

    // Leases: two ACTIVE (different drivers, taxis become LEASED) and one DRAFT.
    leaseA = await f.activeLease({ startDate: daysFromToday(-60) });
    leaseB = await f.activeLease({ startDate: daysFromToday(-30) });
    draftLease = await f.draft();

    // Deals: two DRAFT purchases, one cancelled purchase, one DRAFT sale.
    buyerId = (
      await s.api.post('/api/contacts').send({ firstName: 'Dana', lastName: 'Levi' }).expect(201)
    ).body.id as string;
    const purchase = async (): Promise<Ref> =>
      (
        await s.api
          .post('/api/deals')
          .send({
            type: 'PURCHASE',
            vehicle: {
              create: { plateNo: f.nextPlate(), make: 'Hyundai', model: 'i20', year: 2017 },
            },
            counterpartyId: buyerId,
            date: today(),
            price: 40_000,
          })
          .expect(201)
      ).body as Ref;
    await purchase();
    await purchase();
    const toCancel = await purchase();
    await s.api.post(`/api/deals/${toCancel.id}/cancel`).send({}).expect(200);
    await s.api
      .post('/api/deals')
      .send({
        type: 'SALE',
        vehicleId: saleVehicleId,
        counterpartyId: buyerId,
        date: today(),
        price: 59_000,
      })
      .expect(201);

    // Fines on leaseA's car: two NEW + one REASSIGN_SUBMITTED; one NEW on leaseB's car.
    const fine = async (vehicleId: string, offence: number): Promise<Ref> =>
      (
        await s.api
          .post('/api/fines')
          .send({
            vehicleId,
            offenceAt: `${daysFromToday(offence)}T08:15:00.000Z`,
            receivedAt: daysFromToday(-2),
            amount: 250,
          })
          .expect(201)
      ).body as Ref;
    const carA = leaseA.currentSegment?.vehicle?.id as string;
    const carB = leaseB.currentSegment?.vehicle?.id as string;
    await fine(carA, -10);
    await fine(carA, -11);
    const submitted = await fine(carA, -12);
    await s.api
      .patch(`/api/fines/${submitted.id}`)
      .send({ status: 'REASSIGN_SUBMITTED' })
      .expect(200);
    await fine(carB, -10);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function summary(path: string): Promise<Record<string, number>> {
    const res = await s.api.get(path);
    expect({ status: res.status, body: res.status === 200 ? 'ok' : res.body }).toEqual({
      status: 200,
      body: 'ok',
    });
    return (res.body as Summary).counts;
  }

  async function listTotal(path: string): Promise<number> {
    const res = await s.api.get(path);
    expect(res.status).toBe(200);
    return (res.body as { total: number }).total;
  }

  /** Every card must equal what clicking it lists: summary[status] === list total. */
  async function expectMatchesList(
    resource: string,
    statuses: readonly string[],
    filter: string,
  ): Promise<void> {
    const counts = await summary(`/api/${resource}/summary${filter ? `?${filter}` : ''}`);
    const amp = filter ? '&' : '';
    for (const st of statuses) {
      expect(counts[st]).toBe(
        await listTotal(`/api/${resource}?pageSize=1&${filter}${amp}status=${st}`),
      );
    }
  }

  it('vehicles: every status key present, counts honour filters and ignore status', async () => {
    const all = await summary('/api/vehicles/summary');
    expect(Object.keys(all).sort()).toEqual([...VehicleStatus.options].sort());
    expect(all).toMatchObject({ RESERVED: 2, IN_STOCK: 4, LEASED: 2, SOLD: 0 });

    const taxi = await summary('/api/vehicles/summary?isTaxi=true');
    expect(taxi).toMatchObject({ LEASED: 2, RESERVED: 0, IN_STOCK: 1 });
    expect(Object.keys(taxi)).toHaveLength(VehicleStatus.options.length);

    const kia = await summary('/api/vehicles/summary?make=kia&yearFrom=2020&yearTo=2022');
    expect(kia.RESERVED).toBe(1); // the Kia is reserved by its draft sale
    expect(Object.values(kia).reduce((a, b) => a + b, 0)).toBe(1);

    // status in the query is ignored.
    expect(await summary('/api/vehicles/summary?isTaxi=true&status=SOLD')).toEqual(taxi);
    expect(await summary('/api/vehicles/summary?status=RESERVED')).toEqual(all);

    await expectMatchesList('vehicles', VehicleStatus.options, 'isTaxi=false');
    await expectMatchesList('vehicles', VehicleStatus.options, 'q=mazda');
  });

  it('GET /vehicles/summary does not collide with GET /vehicles/:id', async () => {
    await s.api.get('/api/vehicles/summary').expect(200);
    await s.api.get(`/api/vehicles/${stockId}`).expect(200);
    await s.api.get('/api/vehicles/not-a-real-id').expect(404);
  });

  it('leases: all statuses present; driverId / vehicleId filters, status ignored', async () => {
    const all = await summary('/api/leases/summary');
    expect(Object.keys(all).sort()).toEqual([...LeaseStatus.options].sort());
    expect(all).toMatchObject({ DRAFT: 1, ACTIVE: 2, ENDED: 0, TERMINATED: 0 });

    const forA = await summary(`/api/leases/summary?driverId=${leaseA.driverId}`);
    expect(forA).toMatchObject({ DRAFT: 0, ACTIVE: 1, ENDED: 0, TERMINATED: 0 });
    const carB = leaseB.currentSegment?.vehicle?.id as string;
    expect((await summary(`/api/leases/summary?vehicleId=${carB}`)).ACTIVE).toBe(1);
    expect(await summary(`/api/leases/summary?driverId=${leaseA.driverId}&status=DRAFT`)).toEqual(
      forA,
    );
    expect((await summary(`/api/leases/summary?driverId=${draftLease.driverId}`)).DRAFT).toBe(1);

    await expectMatchesList('leases', LeaseStatus.options, `driverId=${leaseB.driverId}`);
    await expectMatchesList('leases', LeaseStatus.options, '');
  });

  it('deals: all statuses present; type / vehicleId / date filters, status ignored', async () => {
    const all = await summary('/api/deals/summary');
    expect(Object.keys(all).sort()).toEqual([...DealStatus.options].sort());
    expect(all).toMatchObject({ DRAFT: 3, CANCELLED: 1, COMPLETED: 0 });

    const sales = await summary('/api/deals/summary?type=SALE');
    expect(sales).toMatchObject({ DRAFT: 1, PENDING: 0, COMPLETED: 0, CANCELLED: 0 });
    expect(await summary('/api/deals/summary?type=SALE&status=CANCELLED')).toEqual(sales);

    const byCar = await summary(`/api/deals/summary?vehicleId=${saleVehicleId}`);
    expect(byCar.DRAFT).toBe(1);
    expect(Object.values(byCar).reduce((a, b) => a + b, 0)).toBe(1);

    const range = await summary(
      `/api/deals/summary?from=${daysFromToday(-5)}&to=${daysFromToday(5)}&counterpartyId=${buyerId}`,
    );
    expect(range).toMatchObject({ DRAFT: 3, CANCELLED: 1 });
    expect((await summary(`/api/deals/summary?to=${daysFromToday(-5)}`)).DRAFT).toBe(0);

    await expectMatchesList('deals', DealStatus.options, 'type=PURCHASE');
    await expectMatchesList('deals', DealStatus.options, `counterpartyId=${buyerId}`);
  });

  it('fines: all statuses present; driverId / vehicleId filters, status ignored', async () => {
    const all = await summary('/api/fines/summary');
    expect(Object.keys(all).sort()).toEqual([...FineStatus.options].sort());
    expect(all).toMatchObject({ NEW: 3, REASSIGN_SUBMITTED: 1, REASSIGNED: 0 });

    const forA = await summary(`/api/fines/summary?driverId=${leaseA.driverId}`);
    expect(forA).toMatchObject({ NEW: 2, REASSIGN_SUBMITTED: 1 });
    expect(await summary(`/api/fines/summary?driverId=${leaseA.driverId}&status=NEW`)).toEqual(
      forA,
    );
    const carB = leaseB.currentSegment?.vehicle?.id as string;
    const forB = await summary(`/api/fines/summary?vehicleId=${carB}`);
    expect(forB).toMatchObject({ NEW: 1, REASSIGN_SUBMITTED: 0 });

    await expectMatchesList('fines', FineStatus.options, `driverId=${leaseA.driverId}`);
  });

  it('requires authentication', async () => {
    for (const r of ['vehicles', 'leases', 'deals', 'fines']) {
      await request(s.t.http).get(`/api/${r}/summary`).expect(401);
    }
  });
});
