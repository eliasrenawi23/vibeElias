import { addDays } from '@renawi/shared';
import { Factory, LeaseBody } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

interface FineBody {
  id: string;
  vehicleId: string;
  driverId: string | null;
  contractId: string | null;
  fineNo: string | null;
  amount: number;
  status: string;
  receivedAt: string;
  offenceAt: string;
  reassignDeadline: string | null;
  chargeEntryId: string | null;
  vehicle: { id: string; plateNo: string };
  driver: { id: string; name: string } | null;
  contract: { id: string; contractNo: number } | null;
  alerts: string[];
}

describe('Fines (e2e)', () => {
  let s: Session;
  let f: Factory;
  let lease: LeaseBody;
  let vehicleId: string;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 5);
    lease = await f.activeLease({ startDate: daysFromToday(-60), monthlyRent: 6000 });
    vehicleId = lease.currentSegment?.vehicle?.id as string;
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function create(body: Record<string, unknown>): Promise<FineBody> {
    const res = await s.api.post('/api/fines').send({
      vehicleId,
      offenceAt: `${daysFromToday(-20)}T08:15:00.000Z`,
      receivedAt: daysFromToday(-5),
      amount: 250,
      ...body,
    });
    expect({ status: res.status, body: res.status === 201 ? 'ok' : res.body }).toEqual({
      status: 201,
      body: 'ok',
    });
    return res.body as FineBody;
  }

  it('auto-matches the driver of the segment holding the car and sets the deadline', async () => {
    const fine = await create({ fineNo: '52-111', authority: 'משטרה' });
    expect(fine).toMatchObject({
      vehicleId,
      driverId: lease.driverId,
      contractId: lease.id,
      status: 'NEW',
      reassignDeadline: addDays(daysFromToday(-5), 90),
      vehicle: { id: vehicleId },
      driver: { id: lease.driverId, name: lease.driver.name },
      contract: { id: lease.id, contractNo: lease.contractNo },
      alerts: [],
    });
    // Before the lease started nobody had the car.
    const before = await create({ offenceAt: `${daysFromToday(-90)}T08:15:00.000Z` });
    expect(before).toMatchObject({ driverId: null, contractId: null, driver: null });
    // A draft lease does not count.
    const idle = await f.taxi();
    await f.draft({ vehicleId: idle.id, startDate: daysFromToday(-10) });
    const onDraft = await create({ vehicleId: idle.id, offenceAt: `${today()}T06:00:00.000Z` });
    expect(onDraft.driverId).toBeNull();
    expectError(
      await s.api.post('/api/fines').send({
        vehicleId: 'missing',
        offenceAt: `${today()}T06:00:00.000Z`,
        receivedAt: today(),
        amount: 1,
      }),
      404,
      'errors.notFound',
      [{ path: 'vehicleId', message: 'errors.notFound' }],
    );
  });

  it('flags reassignment deadlines of NEW fines', async () => {
    const soon = await create({ receivedAt: daysFromToday(-80) });
    expect(soon.alerts).toEqual(['reassignDueSoon']);
    const late = await create({ receivedAt: daysFromToday(-95) });
    expect(late.alerts).toEqual(['reassignOverdue']);
    const submitted = (
      await s.api.patch(`/api/fines/${late.id}`).send({ status: 'REASSIGN_SUBMITTED' }).expect(200)
    ).body as FineBody;
    expect(submitted.alerts).toEqual([]);

    const list = await s.api
      .get(`/api/fines?status=NEW&vehicleId=${vehicleId}&pageSize=100`)
      .expect(200);
    const items = (list.body as { items: FineBody[] }).items;
    expect(items.map((i) => i.id)).toContain(soon.id);
    expect(items.map((i) => i.id)).not.toContain(late.id);
    const byDriver = await s.api.get(`/api/fines?driverId=${lease.driverId}`).expect(200);
    expect((byDriver.body as { total: number }).total).toBeGreaterThanOrEqual(3);
  });

  it('updates a fine: driver override, re-match on a new offence time, deadline follows receivedAt', async () => {
    const fine = await create({ offenceAt: `${daysFromToday(-90)}T08:15:00.000Z` });
    expect(fine.driverId).toBeNull();
    const rematched = (
      await s.api
        .patch(`/api/fines/${fine.id}`)
        .send({ offenceAt: `${daysFromToday(-1)}T08:15:00.000Z`, receivedAt: today() })
        .expect(200)
    ).body as FineBody;
    expect(rematched).toMatchObject({
      driverId: lease.driverId,
      contractId: lease.id,
      reassignDeadline: addDays(today(), 90),
    });
    const other = await f.driver();
    const overridden = (
      await s.api
        .patch(`/api/fines/${fine.id}`)
        .send({ driverId: other.id, contractId: null })
        .expect(200)
    ).body as FineBody;
    expect(overridden).toMatchObject({
      driverId: other.id,
      contractId: null,
      driver: { id: other.id },
    });
  });

  it('rebills a fine we paid: expense + FINE charge on the driver, status PAID_BY_US', async () => {
    const fine = await create({ fineNo: '52-999', amount: 500 });
    const res = await s.api.post(`/api/fines/${fine.id}/rebill`).expect(200);
    const rebilled = res.body as FineBody;
    expect(rebilled).toMatchObject({ status: 'PAID_BY_US', driverId: lease.driverId });
    expect(rebilled.chargeEntryId).toEqual(expect.any(String));

    const charge = await s.api.get(`/api/ledger/${rebilled.chargeEntryId}`).expect(200);
    expect(charge.body).toMatchObject({
      type: 'CHARGE',
      chargeKind: 'FINE',
      amount: 500,
      driverId: lease.driverId,
      contractId: lease.id,
      vehicleId,
      date: today(),
      dueDate: today(),
      reference: '52-999',
    });
    const expenses = await s.api
      .get(`/api/vehicles/${vehicleId}/expenses?category=FINE`)
      .expect(200);
    const items = (
      expenses.body as { items: { amount: number; paidBy: string; rebilledEntryId: string }[] }
    ).items;
    expect(items).toEqual([
      expect.objectContaining({
        amount: 500,
        paidBy: 'US',
        rebilledEntryId: rebilled.chargeEntryId,
      }),
    ]);

    expectError(await s.api.post(`/api/fines/${fine.id}/rebill`), 409, 'errors.alreadyRebilled');
    expectError(
      await s.api.patch(`/api/fines/${fine.id}`).send({ amount: 600 }),
      409,
      'errors.alreadyRebilled',
    );
    const noDriver = await create({ offenceAt: `${daysFromToday(-90)}T08:15:00.000Z` });
    expectError(await s.api.post(`/api/fines/${noDriver.id}/rebill`), 409, 'errors.fineNoDriver');

    // Rebill with an explicit driver, amount and date.
    const other = await f.driver();
    const custom = (
      await s.api
        .post(`/api/fines/${noDriver.id}/rebill`)
        .send({ driverId: other.id, amount: 300, date: daysFromToday(-1), description: 'דוח חניה' })
        .expect(200)
    ).body as FineBody;
    expect(custom).toMatchObject({ status: 'PAID_BY_US', driverId: other.id });
    const otherLedger = await f.ledger(other.id);
    expect(otherLedger.items).toEqual([
      expect.objectContaining({ chargeKind: 'FINE', amount: 300, description: 'דוח חניה' }),
    ]);
  });
});
