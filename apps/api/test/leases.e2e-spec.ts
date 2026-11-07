import {
  addDays,
  addPeriods,
  daysInMonth,
  maxIsoDate,
  monthsBetween,
  periodEnd,
  periodOf,
  prorate,
  sumMoney,
} from '@renawi/shared';
import { Factory, last31DayMonthBefore, LeaseBody, LedgerEntryBody, yearAfter } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

describe('Leases (e2e)', () => {
  let s: Session;
  let f: Factory;
  const P = periodOf(today());
  const D = daysInMonth(P);
  const prev = addPeriods(P, -1);

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 3);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function vehicleStatus(id: string): Promise<string> {
    return ((await s.api.get(`/api/vehicles/${id}`).expect(200)).body as { status: string }).status;
  }

  async function entries(driverId: string, query = '?includeVoided=true') {
    return (await f.ledger(driverId, query)).items;
  }

  const rentOf = (items: LedgerEntryBody[], period: string) =>
    items.filter((e) => e.chargeKind === 'RENT' && e.rentPeriod === period && !e.voidedAt);

  describe('drafts', () => {
    it('creates a DRAFT with its first segment, which locks the licence and the car', async () => {
      const driver = await f.driver();
      const license = await f.license();
      const taxi = await f.taxi();
      const draft = await f.draft({
        driverId: driver.id,
        taxiLicenseId: license.id,
        vehicleId: taxi.id,
        startDate: daysFromToday(3),
        monthlyRent: 6400,
        depositAmount: 5000,
        depositKind: 'CHECK',
        notes: 'חוזה ראשון',
      });
      expect(draft).toMatchObject({
        status: 'DRAFT',
        type: 'CAR_AND_NUMBER',
        billingPeriod: 'MONTHLY',
        paymentDay: 10,
        depositAmount: 5000,
        notes: 'חוזה ראשון',
        responsibilities: {
          insurance: 'DRIVER',
          test: 'DRIVER',
          repairs: 'DRIVER',
          fines: 'DRIVER',
        },
        driver: { id: driver.id, name: driver.name },
        currentSegment: {
          taxiLicense: { id: license.id, licenseNo: license.licenseNo },
          vehicle: { id: taxi.id, plateNo: taxi.plateNo },
          monthlyRent: 6400,
          startDate: daysFromToday(3),
        },
        balance: { balance: 0, depositHeld: 0 },
        openCharges: [],
        alerts: ['draft'],
      });
      expect(draft.segments).toHaveLength(1);
      // A draft bills nothing and does not move the car yet.
      expect(await vehicleStatus(taxi.id)).toBe('IN_STOCK');
      expect((await entries(driver.id)).length).toBe(0);

      const driver2 = await f.driver();
      const taxi2 = await f.taxi();
      expectError(
        await s.api.post('/api/leases').send({
          driverId: driver2.id,
          type: 'CAR_AND_NUMBER',
          taxiLicenseId: license.id,
          vehicleId: taxi2.id,
          startDate: today(),
          endDate: yearAfter(today()),
          monthlyRent: 6000,
        }),
        409,
        'errors.licenseInUse',
      );
      const license2 = await f.license();
      expectError(
        await s.api.post('/api/leases').send({
          driverId: driver2.id,
          type: 'CAR_AND_NUMBER',
          taxiLicenseId: license2.id,
          vehicleId: taxi.id,
          startDate: today(),
          endDate: yearAfter(today()),
          monthlyRent: 6000,
        }),
        409,
        'errors.vehicleInUse',
      );
      const lic = await s.api.get(`/api/taxi-licenses/${license.id}`).expect(200);
      expect(lic.body).toMatchObject({
        currentSegment: { contractId: draft.id, contractStatus: 'DRAFT' },
      });
      expect((lic.body as { alerts: string[] }).alerts).not.toContain('idle');

      // Preview: what activation would bill (a draft is previewed as if active).
      const preview = await s.api
        .get(`/api/leases/billing/preview?contractId=${draft.id}&period=${addPeriods(P, 1)}`)
        .expect(200);
      const lines = (preview.body as { charges: { rentPeriod: string; contractId: string }[] })
        .charges;
      expect(lines.map((l) => l.rentPeriod)).toEqual(
        monthsBetween(periodOf(daysFromToday(3)), addPeriods(P, 1)),
      );
      expect(lines.every((l) => l.contractId === draft.id)).toBe(true);
    });

    it('validates the draft', async () => {
      const driver = await f.driver();
      const base = {
        driverId: driver.id,
        type: 'CAR_AND_NUMBER',
        startDate: today(),
        endDate: yearAfter(today()),
        monthlyRent: 6000,
      };
      const license = await f.license();
      const taxi = await f.taxi();
      const ok = { ...base, taxiLicenseId: license.id, vehicleId: taxi.id };

      expectError(
        await s.api.post('/api/leases').send({ ...ok, billingPeriod: 'WEEKLY' }),
        400,
        'errors.validation',
        [{ path: 'billingPeriod', message: 'validation.billingPeriodUnsupported' }],
      );
      expectError(
        await s.api.post('/api/leases').send({ ...ok, endDate: today() }),
        400,
        'errors.validation',
        [{ path: 'endDate', message: 'validation.endAfterStart' }],
      );
      expectError(
        await s.api.post('/api/leases').send({ ...ok, vehicleId: undefined }),
        400,
        'errors.validation',
        [{ path: 'vehicleId', message: 'validation.required' }],
      );
      expectError(
        await s.api.post('/api/leases').send({ ...ok, paymentDay: 29 }),
        400,
        'errors.validation',
        [{ path: 'paymentDay', message: 'validation.max::{"max":28}' }],
      );

      const inactive = await f.driver({ status: 'INACTIVE' });
      expectError(
        await s.api.post('/api/leases').send({ ...ok, driverId: inactive.id }),
        409,
        'errors.driverInactive',
      );
      const suspended = await f.license({ status: 'SUSPENDED' });
      expectError(
        await s.api.post('/api/leases').send({ ...ok, taxiLicenseId: suspended.id }),
        409,
        'errors.licenseNotActive',
      );
      const privateCar = await f.taxi({ isTaxi: false });
      expectError(
        await s.api.post('/api/leases').send({ ...ok, vehicleId: privateCar.id }),
        409,
        'errors.vehicleNotAvailable',
      );
      const reserved = await f.taxi({ status: 'RESERVED' });
      expectError(
        await s.api.post('/api/leases').send({ ...ok, vehicleId: reserved.id }),
        409,
        'errors.vehicleNotAvailable',
      );
      const old = await f.taxi({ year: Number(today().slice(0, 4)) - 12 });
      expectError(
        await s.api.post('/api/leases').send({ ...ok, vehicleId: old.id }),
        409,
        'errors.taxiAgeBlocked',
      );
      expectError(
        await s.api.post('/api/leases').send({ ...ok, vehicleId: 'missing' }),
        404,
        'errors.notFound',
        [{ path: 'vehicleId', message: 'errors.notFound' }],
      );
      // NUMBER_ONLY: only the driver's own car (or none).
      expectError(
        await s.api.post('/api/leases').send({ ...ok, type: 'NUMBER_ONLY' }),
        409,
        'errors.vehicleNotAvailable',
      );
      const ten = await f.taxi({ year: Number(today().slice(0, 4)) - 10 });
      const tenYears = await f.draft({ ...base, taxiLicenseId: license.id, vehicleId: ten.id });
      expect(tenYears.status).toBe('DRAFT');
    });
  });

  describe('activation and billing', () => {
    let lease: LeaseBody;
    const M = last31DayMonthBefore(P);
    const start = `${M}-16`;
    const months = monthsBetween(M, P);

    it('activates with a deposit: DEPOSIT_IN, car LEASED, rent charges up to this month', async () => {
      const draft = await f.draft({ startDate: start, monthlyRent: 6500, paymentDay: 10 });
      lease = await f.activate(draft.id, {
        deposit: { amount: 5000, kind: 'CHECK', reference: 'צ׳ק 0042' },
        handoverChecklist: { photosTaken: true, km: 54321, fuelLevel: 'FULL' },
      });
      expect(lease).toMatchObject({
        status: 'ACTIVE',
        alerts: expect.arrayContaining(['overdue']),
      });
      expect(lease.signedAt).toEqual(expect.any(String));
      expect(lease.handoverChecklist).toMatchObject({ photosTaken: true, km: 54321, jack: false });
      expect(await vehicleStatus(lease.currentSegment?.vehicle?.id as string)).toBe('LEASED');

      const items = await entries(lease.driverId);
      const deposit = items.filter((e) => e.type === 'DEPOSIT_IN');
      expect(deposit).toEqual([
        expect.objectContaining({ amount: 5000, method: 'CHECK', reference: 'צ׳ק 0042' }),
      ]);
      const rent = items.filter((e) => e.chargeKind === 'RENT');
      expect(rent.map((e) => e.rentPeriod)).toEqual(months);
      // Start on the 16th of a 31-day month: round2(rent x 16 / 31), due on the start day.
      expect(rent[0]).toMatchObject({
        amount: prorate(6500, 16, 31),
        date: start,
        dueDate: start,
        segmentId: lease.currentSegment?.id,
        vehicleId: lease.currentSegment?.vehicle?.id,
        taxiLicenseId: lease.currentSegment?.taxiLicense.id,
      });
      expect(prorate(6500, 16, 31)).toBe(3354.84);
      for (const e of rent.slice(1)) {
        expect(e).toMatchObject({ amount: 6500, dueDate: `${e.rentPeriod}-10` });
      }
      const expected = sumMoney([3354.84, ...rent.slice(1).map(() => 6500)]);
      expect(lease.balance).toEqual({
        charged: expected,
        paid: 0,
        credited: 0,
        balance: expected,
        depositHeld: 5000,
      });
      expect(lease.openCharges).toHaveLength(months.length);

      expectError(
        await s.api.post(`/api/leases/${lease.id}/activate`),
        409,
        'errors.invalidTransition',
      );
    });

    it('billing run is idempotent (and may bill one month ahead)', async () => {
      const before = (await entries(lease.driverId)).length;
      const run1 = await s.api.post('/api/leases/billing/run').expect(200);
      expect(run1.body).toMatchObject({ created: 0, period: P });
      const run2 = await s.api.post('/api/leases/billing/run').send({}).expect(200);
      expect(run2.body).toMatchObject({ created: 0 });
      expect((await entries(lease.driverId)).length).toBe(before);
      const preview = await s.api.get('/api/leases/billing/preview').expect(200);
      expect((preview.body as { charges: unknown[] }).charges).toEqual([]);

      const next = addPeriods(P, 1);
      const ahead = await s.api.get(`/api/leases/billing/preview?period=${next}`).expect(200);
      const aheadLines = (ahead.body as { charges: { contractId: string; amount: number }[] })
        .charges;
      expect(aheadLines).toEqual([
        expect.objectContaining({ contractId: lease.id, amount: 6500, rentPeriod: next }),
      ]);
      const run3 = await s.api
        .post('/api/leases/billing/run')
        .send({ period: next, contractId: lease.id })
        .expect(200);
      expect(run3.body).toMatchObject({ created: 1, contracts: 1, period: next });
      const run4 = await s.api
        .post('/api/leases/billing/run')
        .send({ period: next, contractId: lease.id })
        .expect(200);
      expect(run4.body).toMatchObject({ created: 0 });
      expect((await entries(lease.driverId)).length).toBe(before + 1);

      expectError(
        await s.api.post('/api/leases/billing/run').send({ period: addPeriods(P, 2) }),
        400,
        'errors.validation',
        [{ path: 'period', message: 'validation.invalidPeriod' }],
      );
    });
  });

  describe('segments', () => {
    it('swaps the car on the 10th: two RENT lines summing to the rent, car statuses flip', async () => {
      const taxi1 = await f.taxi();
      const taxi2 = await f.taxi();
      const lease = await f.activeLease({
        vehicleId: taxi1.id,
        startDate: `${prev}-05`,
        monthlyRent: 6000,
        paymentDay: 1,
      });
      const before = lease.balance.balance;
      const swapDate = `${P}-10`;

      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/segments`)
          .send({ startDate: `${prev}-05`, vehicleId: taxi2.id }),
        400,
        'errors.validation',
        [{ path: 'startDate', message: 'validation.segmentStartTooEarly' }],
      );
      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/segments`)
          .send({ startDate: swapDate, monthlyRent: 6000 }),
        400,
        'errors.validation',
        [{ path: 'monthlyRent', message: 'validation.nothingToChange' }],
      );
      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/segments`)
          .send({ startDate: swapDate, vehicleId: null }),
        400,
        'errors.validation',
        [{ path: 'vehicleId', message: 'validation.required' }],
      );
      const busy = await f.activeLease();
      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/segments`)
          .send({ startDate: swapDate, vehicleId: busy.currentSegment?.vehicle?.id }),
        409,
        'errors.vehicleInUse',
      );

      const res = await s.api
        .post(`/api/leases/${lease.id}/segments`)
        .send({ startDate: swapDate, vehicleId: taxi2.id, reason: 'תאונה' })
        .expect(200);
      const after = res.body as LeaseBody;
      expect(after.currentSegment).toMatchObject({
        vehicle: { id: taxi2.id },
        startDate: swapDate,
        monthlyRent: 6000,
      });
      expect(after.segments.map((g) => [g.vehicle?.id, g.startDate, g.endDate, g.reason])).toEqual([
        [taxi2.id, swapDate, null, 'תאונה'],
        [taxi1.id, `${prev}-05`, `${P}-09`, null],
      ]);
      expect(await vehicleStatus(taxi1.id)).toBe('IN_STOCK');
      expect(await vehicleStatus(taxi2.id)).toBe('LEASED');

      const items = await entries(lease.driverId);
      const lines = rentOf(items, P);
      expect(lines.map((e) => [e.vehicleId, e.date, e.amount])).toEqual([
        [taxi1.id, `${P}-01`, prorate(6000, 9, D)],
        [taxi2.id, swapDate, sumMoney([6000, -prorate(6000, 9, D)])],
      ]);
      expect(sumMoney(lines.map((e) => e.amount))).toBe(6000);
      const voided = items.filter((e) => e.rentPeriod === P && e.voidedAt);
      expect(voided).toEqual([
        expect.objectContaining({ amount: 6000, segmentId: null, voidReason: expect.any(String) }),
      ]);
      // The previous month is untouched and the balance is unchanged.
      expect(rentOf(items, prev)).toHaveLength(1);
      expect(after.balance.balance).toBe(before);
    });
  });

  describe('end and renewal', () => {
    it('terminates early: CREDIT for unused days, PENALTY and deposit APPLY', async () => {
      const lease = await f.activeLease(
        { startDate: `${prev}-01`, monthlyRent: 6000, depositAmount: 5000 },
        { deposit: {} },
      );
      expect(lease.balance).toMatchObject({ balance: 12000, depositHeld: 5000 });
      const end = `${P}-20`;
      const res = await s.api
        .post(`/api/leases/${lease.id}/end`)
        .send({
          actualEndDate: end,
          reason: 'TERMINATED_BY_DRIVER',
          applyPenalty: true,
          depositAction: 'APPLY',
          note: 'עזב את התחנה',
          returnChecklist: { km: 120000, keysReturned: true },
        })
        .expect(200);
      const ended = res.body as LeaseBody;
      const credit = sumMoney([6000, -prorate(6000, 20, D)]);
      expect(ended).toMatchObject({
        status: 'TERMINATED',
        endReason: 'TERMINATED_BY_DRIVER',
        actualEndDate: end,
        terminationNote: 'עזב את התחנה',
        currentSegment: null,
        returnChecklist: { km: 120000, keysReturned: true, newDamages: false },
      });
      expect(ended.segments[0]?.endDate).toBe(end);
      expect(await vehicleStatus(lease.segments[0]?.vehicle?.id as string)).toBe('IN_STOCK');

      const items = await entries(lease.driverId);
      expect(items.filter((e) => e.type === 'CREDIT').map((e) => e.amount)).toEqual([credit]);
      expect(items.filter((e) => e.chargeKind === 'PENALTY').map((e) => e.amount)).toEqual([6000]);
      const applied = items.filter((e) => e.type === 'DEPOSIT_APPLIED');
      const offset = items.filter((e) => e.type === 'PAYMENT' && e.method === 'OFFSET');
      expect(applied.map((e) => e.amount)).toEqual([5000]);
      expect(offset.map((e) => e.amount)).toEqual([5000]);
      const balance = sumMoney([12000, 6000, -credit, -5000]);
      expect(ended.balance).toMatchObject({ balance, depositHeld: 0, credited: credit });

      // The views agree with the contract.
      const view = await s.api.get(`/api/ledger/balances?driverId=${lease.driverId}`).expect(200);
      expect((view.body as { items: unknown[] }).items).toEqual([
        expect.objectContaining({ balance, depositHeld: 0 }),
      ]);

      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/end`)
          .send({ actualEndDate: end, reason: 'OTHER' }),
        409,
        'errors.invalidTransition',
      );
      expectError(
        await s.api.patch(`/api/leases/${lease.id}`).send({ notes: 'x' }),
        409,
        'errors.leaseNotEditable',
      );
      expectError(
        await s.api
          .post(`/api/leases/${lease.id}/segments`)
          .send({ startDate: `${P}-25`, monthlyRent: 1 }),
        409,
        'errors.leaseNotEditable',
      );
      // The licence is free again.
      const next = await f.draft({ taxiLicenseId: lease.segments[0]?.taxiLicense.id });
      expect(next.status).toBe('DRAFT');
    });

    it('expires at the end date and returns the deposit', async () => {
      const lease = await f.activeLease(
        { startDate: `${prev}-01`, endDate: periodEnd(P), monthlyRent: 4000 },
        { deposit: { amount: 2500 } },
      );
      const res = await s.api
        .post(`/api/leases/${lease.id}/end`)
        .send({
          actualEndDate: periodEnd(P),
          reason: 'EXPIRED',
          depositAction: 'RETURN',
          depositMethod: 'BANK_TRANSFER',
        })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'ENDED', endReason: 'EXPIRED' });
      const items = await entries(lease.driverId);
      expect(items.filter((e) => e.type === 'CREDIT')).toEqual([]);
      expect(items.filter((e) => e.type === 'DEPOSIT_OUT')).toEqual([
        expect.objectContaining({ amount: 2500, method: 'BANK_TRANSFER' }),
      ]);
      expect((res.body as LeaseBody).balance).toMatchObject({ balance: 8000, depositHeld: 0 });
      const late = await f.activeLease({ startDate: `${P}-02` });
      expectError(
        await s.api
          .post(`/api/leases/${late.id}/end`)
          .send({ actualEndDate: `${P}-01`, reason: 'OTHER' }),
        400,
        'errors.validation',
        [{ path: 'actualEndDate', message: 'validation.endAfterStart' }],
      );
    });

    it('renews: old ENDED / RENEWED, new ACTIVE on the same licence and car', async () => {
      const lease = await f.activeLease(
        { startDate: `${addPeriods(P, -2)}-01`, endDate: periodEnd(P), monthlyRent: 5000 },
        { deposit: { amount: 3000 } },
      );
      const newStart = addDays(periodEnd(P), 1);
      const res = await s.api
        .post(`/api/leases/${lease.id}/renew`)
        .send({ endDate: yearAfter(newStart), monthlyRent: 5200, paymentDay: 5 })
        .expect(200);
      const renewed = res.body as LeaseBody;
      expect(renewed.id).not.toBe(lease.id);
      expect(renewed).toMatchObject({
        status: 'ACTIVE',
        renewedFromId: lease.id,
        renewedFrom: { id: lease.id, contractNo: lease.contractNo },
        startDate: newStart,
        endDate: yearAfter(newStart),
        paymentDay: 5,
        driverId: lease.driverId,
        type: lease.type,
        currentSegment: {
          taxiLicense: lease.currentSegment?.taxiLicense,
          vehicle: lease.currentSegment?.vehicle,
          monthlyRent: 5200,
          startDate: newStart,
        },
        openCharges: [],
        balance: { depositHeld: 3000, balance: 15000 },
      });
      const old = await f.lease(lease.id);
      expect(old).toMatchObject({
        status: 'ENDED',
        endReason: 'RENEWED',
        actualEndDate: periodEnd(P),
        currentSegment: null,
        renewedTo: { id: renewed.id },
      });
      expect(old.segments[0]?.endDate).toBe(periodEnd(P));
      const items = await entries(lease.driverId);
      expect(items.filter((e) => e.type === 'DEPOSIT_IN')).toHaveLength(1);
      expect(items.filter((e) => e.type === 'CREDIT')).toEqual([]);
      expect(await vehicleStatus(lease.currentSegment?.vehicle?.id as string)).toBe('LEASED');
      const lic = await s.api
        .get(`/api/taxi-licenses/${lease.currentSegment?.taxiLicense.id}`)
        .expect(200);
      expect(lic.body).toMatchObject({ currentSegment: { contractId: renewed.id } });

      expectError(
        await s.api.post(`/api/leases/${lease.id}/renew`).send({ endDate: yearAfter(newStart) }),
        409,
        'errors.invalidTransition',
      );
      expectError(
        await s.api
          .post(`/api/leases/${renewed.id}/renew`)
          .send({ startDate: newStart, endDate: yearAfter(addDays(newStart, 40)) }),
        400,
        'errors.validation',
        [{ path: 'startDate', message: 'validation.segmentStartTooEarly' }],
      );
    });

    it('renews mid-month: the old contract is credited, the new one billed pro rata', async () => {
      const lease = await f.activeLease({ startDate: `${prev}-01`, monthlyRent: 6200 });
      const newStart = `${P}-16`;
      const renewed = (
        await s.api
          .post(`/api/leases/${lease.id}/renew`)
          .send({ startDate: newStart, endDate: yearAfter(newStart) })
          .expect(200)
      ).body as LeaseBody;
      const items = await entries(lease.driverId);
      const oldPart = prorate(6200, 15, D);
      expect(items.filter((e) => e.type === 'CREDIT').map((e) => e.amount)).toEqual([
        sumMoney([6200, -oldPart]),
      ]);
      const newRent = rentOf(items, P).filter((e) => e.contractId === renewed.id);
      expect(newRent.map((e) => [e.date, e.amount])).toEqual([
        [newStart, prorate(6200, D - 15, D)],
      ]);
      // Old part + new part = one month of rent (to the agora, up to rounding).
      expect(Math.abs(sumMoney([oldPart, prorate(6200, D - 15, D)]) - 6200)).toBeLessThanOrEqual(
        0.01,
      );
    });
  });

  describe('PATCH and DELETE', () => {
    it('edits a DRAFT incl. its first segment', async () => {
      const draft = await f.draft({ monthlyRent: 6000 });
      const other = await f.license();
      const res = await s.api
        .patch(`/api/leases/${draft.id}`)
        .send({ monthlyRent: 6100, taxiLicenseId: other.id, notes: 'עודכן', paymentDay: 3 })
        .expect(200);
      expect(res.body).toMatchObject({
        notes: 'עודכן',
        paymentDay: 3,
        currentSegment: { monthlyRent: 6100, taxiLicense: { id: other.id } },
      });
      // The first licence is free again; a licence in use cannot be taken.
      const busy = await f.activeLease();
      expectError(
        await s.api
          .patch(`/api/leases/${draft.id}`)
          .send({ taxiLicenseId: busy.currentSegment?.taxiLicense.id }),
        409,
        'errors.licenseInUse',
      );
      expectError(
        await s.api.patch(`/api/leases/${draft.id}`).send({ endDate: draft.startDate }),
        400,
        'errors.validation',
        [{ path: 'endDate', message: 'validation.endAfterStart' }],
      );
    });

    it('limits an ACTIVE contract to end date / payment day / terms / responsibilities / notes', async () => {
      const lease = await f.activeLease({ startDate: `${prev}-01`, monthlyRent: 6000 });
      const extended = addDays(lease.endDate, 90);
      const res = await s.api
        .patch(`/api/leases/${lease.id}`)
        .send({
          endDate: extended,
          paymentDay: 15,
          terms: 'תנאים',
          notes: 'הערה',
          responsibilities: { insurance: 'US', test: 'DRIVER', repairs: 'US', fines: 'DRIVER' },
          // Unchanged values of locked fields are accepted.
          depositAmount: lease.depositAmount,
          type: lease.type,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        endDate: extended,
        paymentDay: 15,
        terms: 'תנאים',
        notes: 'הערה',
        responsibilities: { insurance: 'US', repairs: 'US' },
      });
      expectError(
        await s.api.patch(`/api/leases/${lease.id}`).send({ monthlyRent: 7000, depositAmount: 1 }),
        409,
        'errors.leaseNotEditable',
        [
          { path: 'depositAmount', message: 'errors.leaseNotEditable' },
          { path: 'monthlyRent', message: 'errors.leaseNotEditable' },
        ],
      );
      expectError(
        await s.api.patch(`/api/leases/${lease.id}`).send({ endDate: daysFromToday(-1) }),
        400,
        'errors.validation',
        [{ path: 'endDate', message: 'validation.dateInPast' }],
      );

      // Shortening into this month re-bills it pro rata; extending again bills it in full.
      const shortEnd = maxIsoDate(today(), `${P}-25`);
      await s.api.patch(`/api/leases/${lease.id}`).send({ endDate: shortEnd }).expect(200);
      let rent = rentOf(await entries(lease.driverId), P);
      expect(rent.map((e) => e.amount)).toEqual([prorate(6000, Number(shortEnd.slice(8)), D)]);
      await s.api.patch(`/api/leases/${lease.id}`).send({ endDate: extended }).expect(200);
      rent = rentOf(await entries(lease.driverId), P);
      expect(rent.map((e) => e.amount)).toEqual([6000]);
    });

    it('deletes only drafts', async () => {
      const draft = await f.draft();
      await s.api.del(`/api/leases/${draft.id}`).expect(204);
      expectError(await s.api.get(`/api/leases/${draft.id}`), 404, 'errors.notFound');
      // Licence and car are free again.
      const again = await f.draft({
        taxiLicenseId: draft.currentSegment?.taxiLicense.id,
        vehicleId: draft.currentSegment?.vehicle?.id,
      });
      expect(again.status).toBe('DRAFT');
      const active = await f.activeLease();
      expectError(await s.api.del(`/api/leases/${active.id}`), 409, 'errors.leaseNotEditable');
    });
  });

  describe('deposits, checklists, lists', () => {
    it('records deposit IN / OUT / APPLY and limits OUT / APPLY to the held amount', async () => {
      const lease = await f.activeLease({ startDate: `${P}-01`, monthlyRent: 3000 });
      expect(lease.balance).toMatchObject({ balance: 3000, depositHeld: 0 });
      let res = await s.api
        .post(`/api/leases/${lease.id}/deposit`)
        .send({ action: 'IN', amount: 1000, kind: 'CASH' })
        .expect(200);
      expect((res.body as LeaseBody).balance).toMatchObject({ balance: 3000, depositHeld: 1000 });
      res = await s.api
        .post(`/api/leases/${lease.id}/deposit`)
        .send({ action: 'OUT', amount: 200, method: 'BIT' })
        .expect(200);
      expect((res.body as LeaseBody).balance).toMatchObject({ depositHeld: 800 });
      expectError(
        await s.api.post(`/api/leases/${lease.id}/deposit`).send({ action: 'APPLY', amount: 801 }),
        409,
        'errors.depositInsufficient',
      );
      res = await s.api
        .post(`/api/leases/${lease.id}/deposit`)
        .send({ action: 'APPLY', amount: 300, note: 'קיזוז' })
        .expect(200);
      expect((res.body as LeaseBody).balance).toMatchObject({ balance: 2700, depositHeld: 500 });

      // Voiding the application voids its OFFSET payment too.
      const items = await entries(lease.driverId);
      const applied = items.find((e) => e.type === 'DEPOSIT_APPLIED') as LedgerEntryBody;
      await s.api.post(`/api/ledger/${applied.id}/void`).send({ reason: 'בוטל' }).expect(200);
      const after = await f.lease(lease.id);
      expect(after.balance).toMatchObject({ balance: 3000, depositHeld: 800 });
      const offset = (await entries(lease.driverId)).find((e) => e.method === 'OFFSET');
      expect(offset?.voidedAt).toEqual(expect.any(String));

      const draft = await f.draft();
      expectError(
        await s.api.post(`/api/leases/${draft.id}/deposit`).send({ action: 'IN', amount: 5 }),
        409,
        'errors.invalidTransition',
      );
    });

    it('saves checklists with defaults', async () => {
      const draft = await f.draft();
      const res = await s.api
        .patch(`/api/leases/${draft.id}/checklists`)
        .send({ handoverChecklist: { photosTaken: true, km: 1000, fuelLevel: 'HALF' } })
        .expect(200);
      expect((res.body as LeaseBody).handoverChecklist).toMatchObject({
        photosTaken: true,
        km: 1000,
        fuelLevel: 'HALF',
        jack: false,
        damages: null,
      });
      expect((await s.api.patch(`/api/leases/${draft.id}/checklists`).send({})).status).toBe(400);
      expect(
        (
          await s.api
            .patch(`/api/leases/${draft.id}/checklists`)
            .send({ returnChecklist: { fuelLevel: 'LOTS' } })
        ).status,
      ).toBe(400);
    });

    it('NUMBER_ONLY on the driver own car bills licence income only', async () => {
      const driver = await f.driver();
      const car = await f.driverCar(driver.id);
      const lease = await f.activeLease({
        driverId: driver.id,
        type: 'NUMBER_ONLY',
        vehicleId: car.id,
        startDate: `${P}-01`,
        monthlyRent: 1400,
      });
      expect(lease.currentSegment?.vehicle?.id).toBe(car.id);
      expect(await vehicleStatus(car.id)).toBe('EXTERNAL');
      const rent = rentOf(await entries(driver.id), P);
      expect(rent).toEqual([
        expect.objectContaining({
          amount: 1400,
          vehicleId: null,
          taxiLicenseId: lease.currentSegment?.taxiLicense.id,
        }),
      ]);
      const none = await f.activeLease({
        type: 'NUMBER_ONLY',
        vehicleId: null,
        startDate: `${P}-01`,
      });
      expect(none.currentSegment?.vehicle).toBeNull();
    });

    it('lists with filters and alerts', async () => {
      const soon = await f.activeLease({
        startDate: daysFromToday(-5),
        endDate: daysFromToday(10),
      });
      const page = await s.api.get('/api/leases?status=ACTIVE&pageSize=200').expect(200);
      const items = (page.body as { items: LeaseBody[] }).items;
      const item = items.find((l) => l.id === soon.id) as LeaseBody;
      expect(item.alerts).toContain('endingSoon');
      expect(item).toMatchObject({
        driver: { id: soon.driverId },
        currentSegment: { taxiLicense: soon.currentSegment?.taxiLicense },
        balance: { balance: soon.balance.balance, depositHeld: 0 },
      });
      expect(Object.keys(item.balance).sort()).toEqual(['balance', 'depositHeld']);

      const byDriver = await s.api.get(`/api/leases?driverId=${soon.driverId}`).expect(200);
      expect((byDriver.body as { items: LeaseBody[] }).items.map((l) => l.id)).toEqual([soon.id]);
      const byLicense = await s.api
        .get(`/api/leases?taxiLicenseId=${soon.currentSegment?.taxiLicense.id}`)
        .expect(200);
      expect((byLicense.body as { items: LeaseBody[] }).items.map((l) => l.id)).toEqual([soon.id]);
      const byVehicle = await s.api
        .get(`/api/leases?vehicleId=${soon.currentSegment?.vehicle?.id}`)
        .expect(200);
      expect((byVehicle.body as { items: LeaseBody[] }).items.map((l) => l.id)).toEqual([soon.id]);
      const byNo = await s.api.get(`/api/leases?q=${soon.contractNo}`).expect(200);
      expect((byNo.body as { items: LeaseBody[] }).items.map((l) => l.id)).toContain(soon.id);
      const drafts = await s.api.get('/api/leases?status=DRAFT&pageSize=200').expect(200);
      expect(
        (drafts.body as { items: LeaseBody[] }).items.every((l) => l.alerts.includes('draft')),
      ).toBe(true);
      expectError(await s.api.get('/api/leases/nope'), 404, 'errors.notFound');
    });
  });
});
