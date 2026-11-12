import { Factory, LedgerEntryBody } from './factories';
import { daysFromToday, expectError, Session, startSession, today } from './helpers';

interface BalanceRow {
  driverId: string;
  driver: { id: string; name: string };
  status: string;
  charged: number;
  paid: number;
  credited: number;
  balance: number;
  depositHeld: number;
  overdue: number;
  ageing: Record<string, number>;
}

describe('Ledger (e2e)', () => {
  let s: Session;
  let f: Factory;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 4);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  async function charge(body: Record<string, unknown>): Promise<LedgerEntryBody> {
    const res = await s.api.post('/api/ledger/charges').send(body);
    expect({ status: res.status, body: res.status === 201 ? 'ok' : res.body }).toEqual({
      status: 201,
      body: 'ok',
    });
    return res.body as LedgerEntryBody;
  }

  async function entry(id: string): Promise<LedgerEntryBody> {
    return (await s.api.get(`/api/ledger/${id}`).expect(200)).body as LedgerEntryBody;
  }

  it('records charges, payments and credits with FIFO allocation and ageing buckets', async () => {
    const driver = await f.driver();
    const old = await charge({
      driverId: driver.id,
      chargeKind: 'DAMAGE',
      amount: 100,
      date: daysFromToday(-50),
      dueDate: daysFromToday(-45),
      description: 'פנס',
    });
    expect(old).toMatchObject({
      type: 'CHARGE',
      chargeKind: 'DAMAGE',
      amount: 100,
      dueDate: daysFromToday(-45),
      allocated: 0,
      remaining: 100,
      driver: { id: driver.id, name: driver.name },
    });
    const mid = await charge({
      driverId: driver.id,
      chargeKind: 'REPAIR',
      amount: 200,
      date: daysFromToday(-10),
    });
    expect(mid.dueDate).toBe(daysFromToday(-10)); // defaults to the charge date
    const fresh = await charge({
      driverId: driver.id,
      chargeKind: 'OTHER',
      amount: 300,
      date: today(),
      dueDate: daysFromToday(5),
    });
    const veryOld = await charge({
      driverId: driver.id,
      chargeKind: 'INSURANCE',
      amount: 70,
      date: daysFromToday(-120),
      dueDate: daysFromToday(-100),
    });

    const pay = await s.api
      .post('/api/ledger/payments')
      .send({ driverId: driver.id, amount: 150, date: today(), method: 'CASH', notes: 'מזומן' })
      .expect(201);
    expect(pay.body).toMatchObject({
      type: 'PAYMENT',
      method: 'CASH',
      description: 'מזומן',
      allocated: null,
      remaining: null,
    });
    // FIFO by due date: 70 (very old) + 80 of the 100.
    expect(await entry(veryOld.id)).toMatchObject({ allocated: 70, remaining: 0 });
    expect(await entry(old.id)).toMatchObject({ allocated: 80, remaining: 20 });
    expect(await entry(mid.id)).toMatchObject({ allocated: 0, remaining: 200 });

    // Explicit allocation target first.
    await s.api
      .post('/api/ledger/payments')
      .send({
        driverId: driver.id,
        amount: 100,
        date: today(),
        method: 'BIT',
        allocateTo: [fresh.id],
      })
      .expect(201);
    expect(await entry(fresh.id)).toMatchObject({ allocated: 100, remaining: 200 });

    const credit = await s.api
      .post('/api/ledger/credits')
      .send({ driverId: driver.id, amount: 50, date: today() })
      .expect(201);
    expect(credit.body).toMatchObject({ type: 'CREDIT', amount: 50, description: null });
    expect(await entry(old.id)).toMatchObject({ allocated: 100, remaining: 0 });
    expect(await entry(mid.id)).toMatchObject({ allocated: 30, remaining: 170 });

    // charged 670, paid 250, credited 50 -> 370; past due: mid 170 (1-30); fresh 200 current.
    const ageing = await s.api.get(`/api/ledger/ageing?driverId=${driver.id}`).expect(200);
    expect(ageing.body).toEqual({
      items: [
        {
          driverId: driver.id,
          driver: { id: driver.id, name: driver.name },
          current: 200,
          d1_30: 170,
          d31_60: 0,
          d61_90: 0,
          d90_plus: 0,
          total: 370,
        },
      ],
      totals: { current: 200, d1_30: 170, d31_60: 0, d61_90: 0, d90_plus: 0, total: 370 },
    });
    const asOf = await s.api
      .get(`/api/ledger/ageing?driverId=${driver.id}&asOf=${daysFromToday(40)}`)
      .expect(200);
    expect((asOf.body as { totals: Record<string, number> }).totals).toMatchObject({
      d31_60: 370,
      total: 370,
    });

    const balances = await s.api.get(`/api/ledger/balances?driverId=${driver.id}`).expect(200);
    expect((balances.body as { items: BalanceRow[] }).items).toEqual([
      {
        driverId: driver.id,
        driver: { id: driver.id, name: driver.name },
        status: 'ACTIVE',
        charged: 670,
        paid: 250,
        credited: 50,
        balance: 370,
        depositHeld: 0,
        overdue: 170,
        ageing: { current: 200, d1_30: 170, d31_60: 0, d61_90: 0, d90_plus: 0, total: 370 },
      },
    ]);
    const detail = await s.api.get(`/api/drivers/${driver.id}`).expect(200);
    expect(detail.body).toMatchObject({
      balance: { charged: 670, paid: 250, credited: 50, balance: 370, depositHeld: 0 },
      ageing: { current: 200, d1_30: 170, total: 370 },
    });
  });

  it('voids entries and rebuilds the allocation', async () => {
    const driver = await f.driver();
    const c = await charge({
      driverId: driver.id,
      chargeKind: 'OTHER',
      amount: 500,
      date: today(),
    });
    const p = (
      await s.api
        .post('/api/ledger/payments')
        .send({ driverId: driver.id, amount: 500, date: today(), method: 'CHECK', reference: '77' })
        .expect(201)
    ).body as LedgerEntryBody;
    expect(await entry(c.id)).toMatchObject({ remaining: 0 });

    const voided = await s.api
      .post(`/api/ledger/${p.id}/void`)
      .send({ reason: 'צ׳ק חזר' })
      .expect(200);
    expect(voided.body).toMatchObject({ id: p.id, voidReason: 'צ׳ק חזר' });
    expect((voided.body as LedgerEntryBody).voidedAt).toEqual(expect.any(String));
    expect(await entry(c.id)).toMatchObject({ allocated: 0, remaining: 500 });
    expectError(
      await s.api.post(`/api/ledger/${p.id}/void`).send({ reason: 'שוב' }),
      409,
      'errors.alreadyVoided',
    );
    expectError(
      await s.api.post(`/api/ledger/${p.id}/void`).send({ reason: 'x' }),
      400,
      'errors.validation',
      [{ path: 'reason', message: 'validation.minLength::{"min":3}' }],
    );
    expectError(
      await s.api.post('/api/ledger/nope/void').send({ reason: 'abc' }),
      404,
      'errors.notFound',
    );

    await s.api.post(`/api/ledger/${c.id}/void`).send({ reason: 'בוטל' }).expect(200);
    expect(await entry(c.id)).toMatchObject({ remaining: 0 });

    // GET /ledger: voided rows hidden by default, totals over non-voided rows.
    const list = await s.api.get(`/api/ledger?driverId=${driver.id}`).expect(200);
    expect(list.body).toMatchObject({ total: 0, totals: { charged: 0, paid: 0, credited: 0 } });
    const all = await s.api.get(`/api/ledger?driverId=${driver.id}&includeVoided=true`).expect(200);
    expect((all.body as { total: number }).total).toBe(2);
  });

  it('lists ledger entries with filters and totals', async () => {
    const driver = await f.driver();
    await charge({ driverId: driver.id, chargeKind: 'FINE', amount: 250, date: daysFromToday(-3) });
    await charge({
      driverId: driver.id,
      chargeKind: 'TEST',
      amount: 120.5,
      date: daysFromToday(-1),
    });
    await s.api
      .post('/api/ledger/payments')
      .send({ driverId: driver.id, amount: 100, date: today(), method: 'BANK_TRANSFER' })
      .expect(201);
    const res = await s.api.get(`/api/ledger?driverId=${driver.id}`).expect(200);
    const body = res.body as { items: LedgerEntryBody[]; total: number; totals: unknown };
    expect(body.total).toBe(3);
    expect(body.items.map((e) => e.type)).toEqual(['PAYMENT', 'CHARGE', 'CHARGE']);
    expect(body.totals).toEqual({ charged: 370.5, paid: 100, credited: 0 });
    const charges = await s.api
      .get(`/api/ledger?driverId=${driver.id}&type=CHARGE&from=${daysFromToday(-2)}`)
      .expect(200);
    expect((charges.body as { items: LedgerEntryBody[] }).items.map((e) => e.amount)).toEqual([
      120.5,
    ]);
    const fines = await s.api.get(`/api/ledger?driverId=${driver.id}&chargeKind=FINE`).expect(200);
    expect((fines.body as { total: number }).total).toBe(1);
  });

  it('counts the documents stored on each entry (statement, list, single entry)', async () => {
    const driver = await f.driver();
    const pay = (
      await s.api
        .post('/api/ledger/payments')
        .send({ driverId: driver.id, amount: 300, date: today(), method: 'CASH' })
        .expect(201)
    ).body as LedgerEntryBody & { documentCount: number };
    expect(pay.documentCount).toBe(0);
    // Two generated confirmations of the payment (rows only; the files are not needed here).
    for (const n of [1, 2]) {
      await s.t.prisma.document.create({
        data: {
          kind: 'RECEIPT',
          fileKey: `test/ledger-${pay.id}-${n}.pdf`,
          fileName: `payment-${n}.pdf`,
          mime: 'application/pdf',
          size: 1234,
          ledgerEntryId: pay.id,
        },
      });
    }
    const statement = (await s.api.get(`/api/drivers/${driver.id}/ledger`).expect(200)).body as {
      items: (LedgerEntryBody & { documentCount: number })[];
    };
    expect(statement.items.map((e) => [e.id, e.documentCount])).toEqual([[pay.id, 2]]);
    const list = (await s.api.get(`/api/ledger?driverId=${driver.id}`).expect(200)).body as {
      items: { documentCount: number }[];
    };
    expect(list.items.map((e) => e.documentCount)).toEqual([2]);
    expect(((await entry(pay.id)) as unknown as { documentCount: number }).documentCount).toBe(2);
    // The paperclip list of the row.
    const docs = (await s.api.get(`/api/documents?ledgerEntryId=${pay.id}`).expect(200)).body as
      | { fileName: string }[]
      | { items: { fileName: string }[] };
    const items = Array.isArray(docs) ? docs : docs.items;
    expect(items.map((d) => d.fileName).sort()).toEqual(['payment-1.pdf', 'payment-2.pdf']);
  });

  it('balances: debtors / overdue filters and paging', async () => {
    const debtor = await f.driver();
    await charge({
      driverId: debtor.id,
      chargeKind: 'OTHER',
      amount: 999,
      date: daysFromToday(-70),
      dueDate: daysFromToday(-65),
    });
    const notDue = await f.driver();
    await charge({
      driverId: notDue.id,
      chargeKind: 'OTHER',
      amount: 10,
      date: today(),
      dueDate: daysFromToday(3),
    });
    const overdue = await s.api
      .get('/api/ledger/balances?overdueOnly=true&pageSize=200')
      .expect(200);
    const ids = (overdue.body as { items: BalanceRow[] }).items.map((r) => r.driverId);
    expect(ids).toContain(debtor.id);
    expect(ids).not.toContain(notDue.id);
    const row = (overdue.body as { items: BalanceRow[] }).items.find(
      (r) => r.driverId === debtor.id,
    );
    expect(row?.ageing).toMatchObject({ d61_90: 999 });

    const debtors = await s.api
      .get('/api/ledger/balances?debtorsOnly=true&pageSize=200')
      .expect(200);
    const debtorIds = (debtors.body as { items: BalanceRow[] }).items.map((r) => r.driverId);
    expect(debtorIds).toEqual(expect.arrayContaining([debtor.id, notDue.id]));
    // Highest balance first.
    const balancesInOrder = (debtors.body as { items: BalanceRow[] }).items.map((r) => r.balance);
    expect([...balancesInOrder].sort((a, b) => b - a)).toEqual(balancesInOrder);

    const page = await s.api.get('/api/ledger/balances?pageSize=1&page=2').expect(200);
    expect(page.body).toMatchObject({ page: 2, pageSize: 1 });
    expect((page.body as { items: unknown[]; total: number }).items).toHaveLength(1);
    expect((page.body as { total: number }).total).toBeGreaterThanOrEqual(4);
    const named = await s.api
      .get(`/api/ledger/balances?q=${encodeURIComponent(debtor.name.split(' ').pop() as string)}`)
      .expect(200);
    expect((named.body as { items: BalanceRow[] }).items.map((r) => r.driverId)).toContain(
      debtor.id,
    );
  });

  it('validates manual entries', async () => {
    const driver = await f.driver();
    const other = await f.driver();
    const lease = await f.activeLease({ driverId: other.id });
    expectError(
      await s.api
        .post('/api/ledger/charges')
        .send({ driverId: driver.id, chargeKind: 'RENT', amount: 1, date: today() }),
      400,
      'errors.validation',
      [{ path: 'chargeKind', message: 'validation.invalidOption' }],
    );
    expectError(
      await s.api
        .post('/api/ledger/payments')
        .send({ driverId: driver.id, amount: 1, date: today(), method: 'OFFSET' }),
      400,
      'errors.validation',
      [{ path: 'method', message: 'validation.invalidOption' }],
    );
    expectError(
      await s.api
        .post('/api/ledger/charges')
        .send({
          driverId: driver.id,
          chargeKind: 'OTHER',
          amount: 1,
          date: today(),
          contractId: lease.id,
        }),
      400,
      'errors.validation',
      [{ path: 'contractId', message: 'validation.invalidValue' }],
    );
    expectError(
      await s.api
        .post('/api/ledger/payments')
        .send({ driverId: 'missing', amount: 1, date: today(), method: 'CASH' }),
      404,
      'errors.notFound',
      [{ path: 'driverId', message: 'errors.notFound' }],
    );
    expectError(
      await s.api
        .post('/api/ledger/payments')
        .send({
          driverId: driver.id,
          amount: 1,
          date: today(),
          method: 'CASH',
          allocateTo: ['nope'],
        }),
      400,
      'errors.validation',
      [{ path: 'allocateTo.0', message: 'validation.invalidValue' }],
    );
    expectError(
      await s.api
        .post('/api/ledger/charges')
        .send({ driverId: driver.id, chargeKind: 'OTHER', amount: 1.234, date: today() }),
      400,
      'errors.validation',
      [{ path: 'amount', message: 'validation.invalidAmount' }],
    );

    // A charge on a contract defaults its attribution to the contract's car and licence.
    const attributed = await charge({
      driverId: other.id,
      contractId: lease.id,
      chargeKind: 'DAMAGE',
      amount: 450,
      date: today(),
    });
    expect(attributed).toMatchObject({
      contractId: lease.id,
      vehicleId: lease.currentSegment?.vehicle?.id,
      taxiLicenseId: lease.currentSegment?.taxiLicense.id,
    });
  });
});
