import { annualFeeDueDate } from '@renawi/shared';
import { Factory } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

interface LicenseBody {
  id: string;
  licenseNo: string;
  status: string;
  holderName: string | null;
  annualFeeDueAt: string | null;
  renewalAt: string | null;
  acquisitionPrice: number | null;
  registeredVehicleId: string | null;
  registeredVehicle: { id: string; plateNo: string } | null;
  currentSegment: {
    id: string;
    contractId: string;
    contractNo: number;
    contractStatus: string;
    driver: { id: string; name: string };
    vehicle: { id: string; plateNo: string } | null;
    monthlyRent: number;
    startDate: string;
  } | null;
  segments: { id: string; endDate: string | null; reason: string | null }[];
  documentCount: number;
  alerts: string[];
}

describe('Taxi licences (e2e)', () => {
  let s: Session;
  let f: Factory;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 1);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function create(body: Record<string, unknown>): Promise<LicenseBody> {
    const res = await s.api.post('/api/taxi-licenses').send(body);
    expect({ status: res.status, body: res.status === 201 ? 'ok' : res.body }).toEqual({
      status: 201,
      body: 'ok',
    });
    return res.body as LicenseBody;
  }

  it('creates a licence with the December fee default and computed alerts', async () => {
    const lic = await create({
      licenseNo: '55501',
      holderName: 'רינאוי מוטורס בע״מ',
      acquisitionPrice: 240000,
    });
    expect(lic).toMatchObject({
      licenseNo: '55501',
      status: 'ACTIVE',
      acquisitionPrice: 240000,
      annualFeeDueAt: annualFeeDueDate(Number(today().slice(0, 4))),
      registeredVehicle: null,
      currentSegment: null,
      segments: [],
      documentCount: 0,
    });
    expect(lic.alerts).toContain('idle');

    const due = await create({
      licenseNo: '55502',
      annualFeeDueAt: daysFromToday(10),
      renewalAt: daysFromToday(-1),
    });
    expect(due.alerts).toEqual(['annualFeeDue', 'renewalOverdue', 'idle']);
    const overdue = await create({ licenseNo: '55503', annualFeeDueAt: daysFromToday(-3) });
    expect(overdue.alerts).toEqual(['annualFeeOverdue', 'idle']);
    const far = await create({ licenseNo: '55504', annualFeeDueAt: daysFromToday(200) });
    expect(far.alerts).toEqual(['idle']);
    const sold = await create({ licenseNo: '55505', status: 'SOLD', soldAt: today() });
    expect(sold.alerts).toEqual([]);
  });

  it('rejects a duplicate licence number and invalid input', async () => {
    expectError(
      await s.api.post('/api/taxi-licenses').send({ licenseNo: '55501' }),
      409,
      'errors.conflict',
      [{ path: 'licenseNo', message: 'validation.duplicate' }],
    );
    const bad = await s.api.post('/api/taxi-licenses').send({ licenseNo: 'no spaces!' });
    expect(bad.status).toBe(400);
    expectError(
      await s.api.post('/api/taxi-licenses').send({ licenseNo: '55599', status: 'SOLD' }),
      400,
      'errors.validation',
      [{ path: 'soldAt', message: 'validation.soldAtRequired' }],
    );
  });

  it('lists with search, status and availability filters', async () => {
    const all = await s.api.get('/api/taxi-licenses?pageSize=50').expect(200);
    expect(all.body).toMatchObject({ total: 5, page: 1, pageSize: 50 });
    const q = await s.api.get('/api/taxi-licenses?q=5550').expect(200);
    expect((q.body as { total: number }).total).toBe(5);
    const one = await s.api.get('/api/taxi-licenses?q=55503').expect(200);
    expect((one.body as { items: LicenseBody[] }).items.map((l) => l.licenseNo)).toEqual(['55503']);
    const sold = await s.api.get('/api/taxi-licenses?status=SOLD').expect(200);
    expect((sold.body as { items: LicenseBody[] }).items.map((l) => l.licenseNo)).toEqual([
      '55505',
    ]);
    const sorted = await s.api.get('/api/taxi-licenses?sort=licenseNo&order=asc').expect(200);
    expect((sorted.body as { items: LicenseBody[] }).items[0]?.licenseNo).toBe('55501');
  });

  it('updates a licence (duplicate number -> 409, unknown -> 404)', async () => {
    const lic = await create({ licenseNo: '55510', annualFeeDueAt: daysFromToday(200) });
    const res = await s.api
      .patch(`/api/taxi-licenses/${lic.id}`)
      .send({ holderName: 'בעלים חדש', status: 'SUSPENDED', renewalAt: daysFromToday(30) })
      .expect(200);
    expect(res.body).toMatchObject({
      holderName: 'בעלים חדש',
      status: 'SUSPENDED',
      renewalAt: daysFromToday(30),
    });
    // SUSPENDED is not idle (only ACTIVE licences earn).
    expect((res.body as LicenseBody).alerts).toEqual(['renewalDue']);
    expectError(
      await s.api.patch(`/api/taxi-licenses/${lic.id}`).send({ licenseNo: '55501' }),
      409,
      'errors.conflict',
      [{ path: 'licenseNo', message: 'validation.duplicate' }],
    );
    expectError(await s.api.get('/api/taxi-licenses/nope'), 404, 'errors.notFound');
  });

  describe('register-vehicle', () => {
    it('registers a young taxi, detaches it and enforces the rules', async () => {
      const lic = await create({ licenseNo: '55520' });
      const other = await create({ licenseNo: '55521' });
      const taxi = await f.taxi({ year: 2022 });
      const ten = await f.taxi({ year: Number(today().slice(0, 4)) - 10 });
      const old = await f.taxi({ year: Number(today().slice(0, 4)) - 12 });
      const privateCar = await f.taxi({ isTaxi: false });

      expectError(
        await s.api
          .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
          .send({ vehicleId: privateCar.id }),
        409,
        'errors.vehicleNotTaxi',
      );
      expectError(
        await s.api
          .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
          .send({ vehicleId: old.id }),
        409,
        'errors.taxiAgeBlocked',
      );
      expectError(
        await s.api
          .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
          .send({ vehicleId: 'missing' }),
        404,
        'errors.notFound',
        [{ path: 'vehicleId', message: 'errors.notFound' }],
      );

      const res = await s.api
        .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
        .send({ vehicleId: taxi.id, meterSealedAt: today() })
        .expect(200);
      expect(res.body).toMatchObject({
        registeredVehicleId: taxi.id,
        registeredVehicle: { id: taxi.id, plateNo: taxi.plateNo },
      });
      const vehicle = await s.api.get(`/api/vehicles/${taxi.id}`).expect(200);
      expect(vehicle.body).toMatchObject({
        meterSealedAt: today(),
        registeredLicense: { id: lic.id, licenseNo: '55520' },
      });

      // One licence per car.
      expectError(
        await s.api
          .post(`/api/taxi-licenses/${other.id}/register-vehicle`)
          .send({ vehicleId: taxi.id }),
        409,
        'errors.vehicleAlreadyRegistered',
      );
      // From 10 years it is only a warning: registration is allowed.
      await s.api
        .post(`/api/taxi-licenses/${other.id}/register-vehicle`)
        .send({ vehicleId: ten.id })
        .expect(200);
      // Re-registering the same car on the same licence is fine.
      await s.api
        .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
        .send({ vehicleId: taxi.id })
        .expect(200);

      const detached = await s.api
        .post(`/api/taxi-licenses/${lic.id}/register-vehicle`)
        .send({ vehicleId: null })
        .expect(200);
      expect(detached.body).toMatchObject({ registeredVehicleId: null, registeredVehicle: null });
      const search = await s.api.get(`/api/taxi-licenses?q=${ten.plateNo}`).expect(200);
      expect((search.body as { items: LicenseBody[] }).items.map((l) => l.id)).toEqual([other.id]);
    });
  });

  it('shows the open segment and the segment history of leases on the licence', async () => {
    const lic = await create({ licenseNo: '55530' });
    const lease = await f.activeLease({ taxiLicenseId: lic.id, monthlyRent: 5500 });
    const detail = (await s.api.get(`/api/taxi-licenses/${lic.id}`).expect(200))
      .body as LicenseBody;
    expect(detail.currentSegment).toMatchObject({
      contractId: lease.id,
      contractNo: lease.contractNo,
      contractStatus: 'ACTIVE',
      driver: { id: lease.driverId, name: lease.driver.name },
      monthlyRent: 5500,
      startDate: lease.startDate,
    });
    expect(detail.currentSegment?.vehicle?.id).toBe(lease.currentSegment?.vehicle?.id);
    expect(detail.alerts).not.toContain('idle');
    expect(detail.segments).toHaveLength(1);

    const available = await s.api.get('/api/taxi-licenses?available=true&pageSize=50').expect(200);
    expect((available.body as { items: LicenseBody[] }).items.map((l) => l.id)).not.toContain(
      lic.id,
    );
    const leased = await s.api.get('/api/taxi-licenses?available=false').expect(200);
    expect((leased.body as { items: LicenseBody[] }).items.map((l) => l.id)).toEqual([lic.id]);
  });
});
