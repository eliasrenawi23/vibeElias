import { Factory } from './factories';
import { daysFromToday, expectError, israeliId, Session, startSession, today } from './helpers';

interface DriverBody {
  id: string;
  contactId: string;
  status: string;
  licenseNo: string | null;
  licenseExpiry: string | null;
  taxiPermitExpiry: string | null;
  medicalExpiry: string | null;
  name: string;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phones: string[];
    idNumber: string | null;
    preferredLang: string;
  };
  activeContract: {
    id: string;
    contractNo: number;
    type: string;
    licenseNo: string | null;
    plateNo: string | null;
    monthlyRent: number | null;
  } | null;
  balance: {
    charged: number;
    paid: number;
    credited: number;
    balance: number;
    depositHeld: number;
  };
  ageing?: Record<string, number>;
  contracts?: { id: string; status: string; licenseNo: string | null; plateNo: string | null }[];
  ownedVehicles?: { id: string; plateNo: string }[];
  documentCount?: number;
  alerts: string[];
}

describe('Drivers (e2e)', () => {
  let s: Session;
  let f: Factory;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 2);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  it('creates a driver with an inline contact (tagged DRIVER)', async () => {
    const res = await s.api
      .post('/api/drivers')
      .send({
        contact: {
          firstName: 'סאמי',
          lastName: 'עבאס',
          phones: ['050-123-4567'],
          idNumber: israeliId('31234567'),
          preferredLang: 'ar',
        },
        licenseNo: '1234567',
        licenseExpiry: daysFromToday(400),
        taxiPermitExpiry: daysFromToday(20),
        medicalExpiry: daysFromToday(-5),
      })
      .expect(201);
    const d = res.body as DriverBody;
    expect(d).toMatchObject({
      name: 'סאמי עבאס',
      status: 'ACTIVE',
      licenseNo: '1234567',
      contact: { firstName: 'סאמי', phones: ['0501234567'], preferredLang: 'ar' },
      activeContract: null,
      balance: { charged: 0, paid: 0, credited: 0, balance: 0, depositHeld: 0 },
      ageing: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 },
      contracts: [],
      ownedVehicles: [],
      documentCount: 0,
    });
    expect(d.alerts).toEqual(['taxiPermitExpiring', 'medicalExpired']);
    const contact = await s.api.get(`/api/contacts/${d.contactId}`).expect(200);
    expect((contact.body as { tags: string[] }).tags).toEqual(['DRIVER']);

    // Same ID number again -> duplicate on the inline contact.
    expectError(
      await s.api
        .post('/api/drivers')
        .send({ contact: { lastName: 'כפול', idNumber: israeliId('31234567') } }),
      409,
      'errors.conflict',
      [{ path: 'contact.idNumber', message: 'validation.duplicate' }],
    );
  });

  it('creates a driver for an existing contact; a contact is one driver only', async () => {
    const contact = (
      await s.api
        .post('/api/contacts')
        .send({ firstName: 'רונן', lastName: 'בן דוד', tags: ['LEAD'] })
        .expect(201)
    ).body as { id: string };
    const res = await s.api
      .post('/api/drivers')
      .send({ contactId: contact.id, taxiPermitNo: 'TP-1' })
      .expect(201);
    expect(res.body).toMatchObject({ contactId: contact.id, name: 'רונן בן דוד' });
    const after = await s.api.get(`/api/contacts/${contact.id}`).expect(200);
    expect((after.body as { tags: string[] }).tags).toEqual(['LEAD', 'DRIVER']);

    expectError(
      await s.api.post('/api/drivers').send({ contactId: contact.id }),
      409,
      'errors.alreadyDriver',
    );
    expectError(
      await s.api.post('/api/drivers').send({ contactId: 'missing' }),
      404,
      'errors.notFound',
      [{ path: 'contactId', message: 'errors.notFound' }],
    );
    expectError(await s.api.post('/api/drivers').send({}), 400, 'errors.validation', [
      { path: 'contactId', message: 'validation.contactRequired' },
    ]);
  });

  it('updates driver fields and the contact block', async () => {
    const d = await f.driver();
    const res = await s.api
      .patch(`/api/drivers/${d.id}`)
      .send({ status: 'INACTIVE', notes: 'הפסקה', contact: { firstName: 'עודכן' } })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'INACTIVE', notes: 'הפסקה' });
    expect((res.body as DriverBody).name.startsWith('עודכן')).toBe(true);
    expectError(
      await s.api.patch('/api/drivers/nope').send({ notes: 'x' }),
      404,
      'errors.notFound',
    );
  });

  it('lists drivers with active contract, balance, overdue alert and filters', async () => {
    const driver = await f.driver({ contact: { firstName: 'פאדי', lastName: 'חורי' } });
    const lease = await f.activeLease(
      { driverId: driver.id, startDate: daysFromToday(-40), monthlyRent: 3000 },
      { deposit: { amount: 2000 } },
    );
    // A manual charge past due makes the driver overdue.
    await s.api
      .post('/api/ledger/charges')
      .send({
        driverId: driver.id,
        chargeKind: 'DAMAGE',
        amount: 400,
        date: daysFromToday(-20),
        dueDate: daysFromToday(-15),
      })
      .expect(201);

    const list = await s.api.get('/api/drivers?q=חורי').expect(200);
    const items = (list.body as { items: DriverBody[] }).items;
    expect(items).toHaveLength(1);
    const row = items[0] as DriverBody;
    expect(row.activeContract).toMatchObject({
      id: lease.id,
      contractNo: lease.contractNo,
      type: 'CAR_AND_NUMBER',
      licenseNo: lease.currentSegment?.taxiLicense.licenseNo,
      plateNo: lease.currentSegment?.vehicle?.plateNo,
      monthlyRent: 3000,
    });
    expect(row.balance.depositHeld).toBe(2000);
    expect(row.balance.balance).toBe(lease.balance.balance + 400);
    expect(row.alerts).toContain('overdue');

    const withBalance = await s.api
      .get('/api/drivers?withBalanceOnly=true&pageSize=100')
      .expect(200);
    expect((withBalance.body as { items: DriverBody[] }).items.map((d) => d.id)).toEqual([
      driver.id,
    ]);
    const active = await s.api.get('/api/drivers?hasActiveLease=true').expect(200);
    expect((active.body as { items: DriverBody[] }).items.map((d) => d.id)).toEqual([driver.id]);
    const inactive = await s.api.get('/api/drivers?status=INACTIVE').expect(200);
    expect((inactive.body as { total: number }).total).toBe(1);
    const byPhone = await s.api.get('/api/drivers?q=050-123').expect(200);
    expect((byPhone.body as { items: DriverBody[] }).items.map((d) => d.name)).toEqual([
      'סאמי עבאס',
    ]);
    const sorted = await s.api.get('/api/drivers?sort=name&order=asc&pageSize=100').expect(200);
    expect((sorted.body as { total: number }).total).toBe(4);

    const detail = (await s.api.get(`/api/drivers/${driver.id}`).expect(200)).body as DriverBody;
    expect(detail.contracts).toEqual([
      expect.objectContaining({
        id: lease.id,
        status: 'ACTIVE',
        licenseNo: lease.currentSegment?.taxiLicense.licenseNo,
      }),
    ]);
    expect(detail.ageing?.total).toBe(detail.balance.balance);
    expect(detail.ageing?.d1_30).toBeGreaterThanOrEqual(400);
    expect(detail.alerts).toContain('overdue');
  });

  it('lists the driver own cars', async () => {
    const driver = await f.driver();
    const car = await f.driverCar(driver.id);
    const detail = (await s.api.get(`/api/drivers/${driver.id}`).expect(200)).body as DriverBody;
    expect(detail.ownedVehicles).toEqual([
      { id: car.id, plateNo: car.plateNo, make: 'Kia', model: 'Niro', year: 2023 },
    ]);
  });

  it('returns the ledger statement with a running balance (deposits do not move it)', async () => {
    const driver = await f.driver();
    await s.api
      .post('/api/ledger/charges')
      .send({ driverId: driver.id, chargeKind: 'OTHER', amount: 1000, date: daysFromToday(-30) })
      .expect(201);
    const lease = await f.activeLease(
      { driverId: driver.id, startDate: today(), monthlyRent: 3100 },
      { deposit: { amount: 1500, date: daysFromToday(-25) } },
    );
    expect(lease.status).toBe('ACTIVE');
    await s.api
      .post('/api/ledger/payments')
      .send({ driverId: driver.id, amount: 600, date: daysFromToday(-20), method: 'CASH' })
      .expect(201);
    const voided = await s.api
      .post('/api/ledger/payments')
      .send({ driverId: driver.id, amount: 50, date: daysFromToday(-19), method: 'BIT' })
      .expect(201);
    await s.api
      .post(`/api/ledger/${(voided.body as { id: string }).id}/void`)
      .send({ reason: 'הוזן בטעות' })
      .expect(200);

    const st = await f.ledger(driver.id);
    const rows = st.items.map((e) => [e.type, e.amount, e.runningBalance]);
    const rent = st.items.filter((e) => e.chargeKind === 'RENT');
    expect(rent.length).toBeGreaterThan(0);
    expect(rows.slice(0, 3)).toEqual([
      ['CHARGE', 1000, 1000],
      ['DEPOSIT_IN', 1500, 1000],
      ['PAYMENT', 600, 400],
    ]);
    expect(st.items.some((e) => e.voidedAt)).toBe(false);
    const last = st.items[st.items.length - 1];
    expect(last?.runningBalance).toBe(st.balance);
    expect(st.depositHeld).toBe(1500);
    expect(st.items[0]).toMatchObject({ allocated: 600, remaining: 400 });
    expect(st.items[2]).toMatchObject({ allocated: null, remaining: null });

    const withVoided = await f.ledger(driver.id, '?includeVoided=true');
    const v = withVoided.items.find((e) => e.voidedAt);
    expect(v).toMatchObject({ amount: 50, voidReason: 'הוזן בטעות', runningBalance: 400 });

    const filtered = await f.ledger(driver.id, `?from=${daysFromToday(-22)}&type=PAYMENT`);
    expect(filtered.openingBalance).toBe(1000);
    expect(filtered.items.map((e) => [e.type, e.runningBalance])).toEqual([['PAYMENT', 400]]);
    expectError(await s.api.get('/api/drivers/nope/ledger'), 404, 'errors.notFound');
  });
});
