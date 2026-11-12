import {
  addDays,
  addMonths,
  addWorkingDays,
  BackupStatusSchema,
  diffDays,
  formatDate,
  formatPlate,
  REPORT_TITLE_KEYS,
  RemindersFeedSchema,
  vatOnMargin,
  type FeedItem,
  type FeedKind,
} from '@renawi/shared';
import { Workbook, type Worksheet } from 'exceljs';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { translator } from '../src/reports/report-i18n';
import { Factory, Ref } from './factories';
import {
  binaryParser,
  daysFromToday,
  expectError,
  israeliId,
  Session,
  startSession,
  today,
} from './helpers';

/**
 * Milestone 5 coverage beyond the smoke spec: every reminders-feed kind (severity + link),
 * PATCH /reminders, export details (n/a, money format, Hebrew, context sheet, totals, no data),
 * the trade book of a completed sale and the backup status.
 */
describe('Milestone 5 coverage: feed kinds, reminders, exports, backup (e2e)', () => {
  let s: Session;
  let f: Factory;
  const T = today();
  const he = translator('he');

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 12);
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  function ok<T>(res: { status: number; body: unknown }, status = 201): T {
    expect({ status: res.status, body: res.status === status ? 'ok' : res.body }).toEqual({
      status,
      body: 'ok',
    });
    return res.body as T;
  }

  async function feedItem(kind: FeedKind, entityId: string, days = 120): Promise<FeedItem> {
    const res = await s.api.get(`/api/reminders/feed?kinds=${kind}&days=${days}&pageSize=200`);
    expect(res.status).toBe(200);
    const parsed = RemindersFeedSchema.safeParse(res.body);
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
    const item = (res.body.items as FeedItem[]).find((i) => i.entityId === entityId);
    if (!item)
      throw new Error(`no ${kind} item for ${entityId}: ${JSON.stringify(res.body.items)}`);
    expect(item.id).toBe(`${kind}:${entityId}`);
    expect(item.daysLeft).toBe(diffDays(T, item.dueAt));
    return item;
  }

  /** Severity rule of the feed for a due date and lead days. */
  function expected(dueAt: string, lead: number): string {
    const left = diffDays(T, dueAt);
    return left < 0 ? 'overdue' : left <= lead ? 'due' : 'upcoming';
  }

  async function contact(body: Record<string, unknown>): Promise<Ref> {
    return ok(await s.api.post('/api/contacts').send(body));
  }

  /* ------------------------------------------------------------------------------------ */
  /* Sale -> trade book + deal transfer                                                    */
  /* ------------------------------------------------------------------------------------ */

  describe('completed sale: deal transfer reminder and trade book', () => {
    const sellerIdNumber = israeliId('03741596');
    const buyerIdNumber = israeliId('02995314');
    let vehicleId: string;
    let plateNo: string;
    let saleId: string;
    let stockPlate: string;

    beforeAll(async () => {
      const seller = await contact({
        firstName: 'יוסי',
        lastName: 'כהן',
        idNumber: sellerIdNumber,
      });
      const buyer = await contact({ firstName: 'רונית', lastName: 'לוי', idNumber: buyerIdNumber });
      plateNo = f.nextPlate();
      const purchase = ok<Ref & { vehicleId: string }>(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: { create: { plateNo, make: 'מאזדה', model: '3', year: 2019 } },
          counterpartyId: seller.id,
          date: daysFromToday(-30),
          price: 50_000,
        }),
      );
      vehicleId = purchase.vehicleId;
      ok(await s.api.post(`/api/deals/${purchase.id}/complete`).send({}), 200);
      ok(
        await s.api
          .post(`/api/vehicles/${vehicleId}/expenses`)
          .send({ category: 'REPAIR', date: daysFromToday(-20), amount: 1_000 }),
      );
      const sale = ok<Ref>(
        await s.api.post('/api/deals').send({
          type: 'SALE',
          vehicleId,
          counterpartyId: buyer.id,
          date: T,
          price: 59_000,
        }),
      );
      saleId = sale.id;
      ok(
        await s.api
          .post(`/api/deals/${saleId}/disclosure`)
          .send({ signedAt: new Date().toISOString() }),
        200,
      );
      ok(await s.api.post(`/api/deals/${saleId}/complete`).send({}), 200);
      // A second car bought but not sold: its sale columns are n/a.
      stockPlate = f.nextPlate();
      ok(
        await s.api.post('/api/deals').send({
          type: 'PURCHASE',
          vehicle: { create: { plateNo: stockPlate, make: 'Kia', model: 'Picanto', year: 2020 } },
          counterpartyId: seller.id,
          date: daysFromToday(-5),
          price: 40_000,
        }),
      );
    });

    it('deal transfer: due 6 working days after the sale', async () => {
      const dueAt = addWorkingDays(T, 6);
      expect(await feedItem('dealTransfer', saleId)).toMatchObject({
        entityType: 'deal',
        dueAt,
        severity: expected(dueAt, 2),
        subtitle: 'רונית לוי',
        link: `/deals/${saleId}`,
      });
    });

    it('trade book row: seller / buyer names + ID numbers, VAT on margin, profit', async () => {
      const res = await s.api.get(`/api/reports/trade-book?from=${daysFromToday(-60)}&to=${T}`);
      expect(res.status).toBe(200);
      const row = (res.body.rows as Record<string, unknown>[]).find((r) => r.plateNo === plateNo);
      const vat = vatOnMargin(59_000, 50_000, 18);
      expect(row).toEqual({
        plateNo,
        vehicle: 'מאזדה 3 2019',
        consignment: false,
        purchaseDate: daysFromToday(-30),
        sellerName: 'יוסי כהן',
        sellerIdNumber,
        purchasePrice: 50_000,
        repairsTotal: 1_000,
        saleDate: T,
        buyerName: 'רונית לוי',
        buyerIdNumber,
        salePrice: 59_000,
        vatOnMargin: vat,
        profit: Math.round((59_000 - 50_000 - 1_000 - vat) * 100) / 100,
      });
      const stock = (res.body.rows as Record<string, unknown>[]).find(
        (r) => r.plateNo === stockPlate,
      );
      expect(stock).toMatchObject({
        saleDate: null,
        buyerName: null,
        salePrice: null,
        profit: null,
      });
      expect(res.body.totals).toMatchObject({ purchasePrice: 90_000, salePrice: 59_000 });
    });

    async function workbook(url: string): Promise<Workbook> {
      const res = await s.api.get(url).buffer(true).parse(binaryParser);
      expect(res.status).toBe(200);
      const bytes = res.body as Buffer;
      const wb = new Workbook();
      await wb.xlsx.load(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      return wb;
    }

    function rowOf(sheet: Worksheet, first: string): number {
      for (let r = 1; r <= sheet.rowCount; r++) {
        if (sheet.getCell(r, 1).value === first) return r;
      }
      throw new Error(`row starting with ${first} not found`);
    }

    it('xlsx: context sheet, Hebrew text, money format, n/a cells and the totals row', async () => {
      const from = daysFromToday(-60);
      const wb = await workbook(`/api/reports/trade-book?from=${from}&to=${T}&format=xlsx&lang=he`);
      const [context, data] = wb.worksheets;
      if (!context || !data) throw new Error('two sheets expected');
      const contextRows = new Map<string, unknown>();
      context.eachRow((row) => {
        // First occurrence: the column list below repeats some labels.
        const key = String(row.getCell(1).value);
        if (!contextRows.has(key)) contextRows.set(key, row.getCell(2).value);
      });
      expect(contextRows.get(he('reports.context.report'))).toBe(
        he(REPORT_TITLE_KEYS['trade-book']),
      );
      expect(contextRows.get(he('reports.context.period'))).toBe(
        `${formatDate(from, 'he')} – ${formatDate(T, 'he')}`,
      );
      expect(contextRows.get(he('reports.context.language'))).toBe(he('language.he'));
      expect(contextRows.get(he('reports.context.rows'))).toBe('2');
      expect(String(contextRows.get(he('reports.context.exportedAt')))).toContain('Asia/Jerusalem');

      expect(data.views[0]?.rightToLeft).toBe(true);
      const headers = (data.getRow(1).values as unknown[]).slice(1);
      expect(headers).toContain(he('reports.columns.sellerIdNumber'));
      const sold = rowOf(data, formatPlate(plateNo));
      const cell = (r: number, key: string) =>
        data.getCell(r, headers.indexOf(he(`reports.columns.${key}`)) + 1);
      expect(cell(sold, 'sellerName').value).toBe('יוסי כהן');
      expect(cell(sold, 'vehicle').value).toBe('מאזדה 3 2019');
      expect(cell(sold, 'salePrice').value).toBe(59_000);
      expect(cell(sold, 'salePrice').numFmt).toBe('"₪" #,##0.00');
      expect(cell(sold, 'saleDate').value).toEqual(new Date(`${T}T00:00:00.000Z`));
      const stock = sold === 2 ? 3 : 2;
      expect(cell(stock, 'saleDate').value).toBe(he('reports.na'));
      expect(cell(stock, 'salePrice').value).toBe(he('reports.na'));

      const total = rowOf(data, he('reports.total'));
      expect(total).toBe(4);
      expect(cell(total, 'purchasePrice').value).toBe(90_000);
      expect(cell(total, 'purchasePrice').numFmt).toBe('"₪" #,##0.00');
    });

    it('csv keeps Hebrew text and writes n/a for missing values', async () => {
      const res = await s.api
        .get(`/api/reports/trade-book?from=${daysFromToday(-60)}&to=${T}&format=csv&lang=he`)
        .buffer(true)
        .parse(binaryParser);
      const text = (res.body as Buffer).toString('utf8');
      expect(text).toContain('יוסי כהן');
      expect(text).toContain(`רונית לוי,${buyerIdNumber}`);
      expect(text).toContain(he('reports.na'));
      expect(text).toContain('59000.00');
    });
  });

  /* ------------------------------------------------------------------------------------ */
  /* Feed kinds                                                                           */
  /* ------------------------------------------------------------------------------------ */

  describe('reminders feed', () => {
    it('insurance: vehicle policy (due) and business policy (overdue)', async () => {
      const car = await f.taxi();
      const policy = ok<Ref>(
        await s.api.post(`/api/vehicles/${car.id}/insurance`).send({
          type: 'COMPULSORY',
          insurer: 'הראל',
          policyNo: 'CMP-1',
          startDate: daysFromToday(-355),
          endDate: daysFromToday(10),
        }),
      );
      expect(await feedItem('insurance', policy.id)).toMatchObject({
        entityType: 'insurance',
        severity: 'due',
        dueAt: daysFromToday(10),
        subtitle: 'הראל · CMP-1',
        link: `/vehicles/${car.id}?tab=insurance`,
      });
      const business = ok<Ref>(
        await s.api.post('/api/insurance').send({
          type: 'TRADE',
          insurer: 'מנורה',
          startDate: daysFromToday(-300),
          endDate: daysFromToday(-2),
        }),
      );
      expect(await feedItem('insurance', business.id)).toMatchObject({
        title: 'מנורה',
        severity: 'overdue',
        link: '/vehicles?tab=insurance',
      });
    });

    it('driver licence (overdue), taxi permit (due), medical (upcoming)', async () => {
      const driver = await f.driver({
        licenseNo: '7711223',
        licenseExpiry: daysFromToday(-1),
        taxiPermitNo: 'TP-9',
        taxiPermitExpiry: daysFromToday(20),
        medicalExpiry: daysFromToday(90),
      });
      const link = `/drivers/${driver.id}`;
      expect(await feedItem('driverLicense', driver.id)).toMatchObject({
        entityType: 'driver',
        severity: 'overdue',
        subtitle: '7711223',
        link,
      });
      expect(await feedItem('taxiPermit', driver.id)).toMatchObject({
        severity: 'due',
        subtitle: 'TP-9',
        link,
      });
      expect(await feedItem('medical', driver.id)).toMatchObject({ severity: 'upcoming', link });
    });

    it('taxi licence fee (due) and renewal (upcoming)', async () => {
      const license = await f.license({
        annualFeeDueAt: daysFromToday(30),
        renewalAt: daysFromToday(100),
      });
      const link = `/taxi-licenses/${license.id}`;
      expect(await feedItem('taxiLicenseFee', license.id)).toMatchObject({
        entityType: 'taxiLicense',
        title: license.licenseNo,
        severity: 'due',
        link,
      });
      expect(await feedItem('taxiLicenseRenewal', license.id)).toMatchObject({
        severity: 'upcoming',
        dueAt: daysFromToday(100),
        link,
      });
    });

    it('lease end (due) and lease documents / driver documents (due / overdue)', async () => {
      const lease = await f.activeLease({ endDate: daysFromToday(20) });
      expect(await feedItem('leaseEnd', lease.id)).toMatchObject({
        entityType: 'lease',
        severity: 'due',
        dueAt: daysFromToday(20),
        link: `/leases/${lease.id}`,
      });
      const file = { fileKey: 'e2e/none.pdf', mime: 'application/pdf', size: 10 };
      const leaseDoc = await s.t.prisma.document.create({
        data: {
          ...file,
          kind: 'CONTRACT',
          fileName: 'contract.pdf',
          title: 'חוזה חתום',
          expiresAt: new Date(`${daysFromToday(10)}T00:00:00.000Z`),
          contractId: lease.id,
        },
      });
      expect(await feedItem('document', leaseDoc.id)).toMatchObject({
        entityType: 'document',
        title: 'חוזה חתום',
        subtitle: `#${lease.contractNo}`,
        severity: 'due',
        link: `/leases/${lease.id}?tab=documents`,
      });
      const driverDoc = await s.t.prisma.document.create({
        data: {
          ...file,
          kind: 'MEDICAL',
          fileName: 'medical.pdf',
          expiresAt: new Date(`${daysFromToday(-3)}T00:00:00.000Z`),
          driverId: lease.driverId,
        },
      });
      expect(await feedItem('document', driverDoc.id)).toMatchObject({
        title: 'medical.pdf',
        severity: 'overdue',
        link: `/drivers/${lease.driverId}?tab=documents`,
      });
    });

    it('contact follow-ups: today is due, yesterday overdue', async () => {
      const todayLead = await contact({ firstName: 'דנה', lastName: 'אברהם', followUpAt: T });
      const late = await contact({
        firstName: 'أحمد',
        lastName: 'خوري',
        phones: ['0533456789'],
        followUpAt: daysFromToday(-1),
      });
      expect(await feedItem('contactFollowUp', todayLead.id)).toMatchObject({
        entityType: 'contact',
        title: 'דנה אברהם',
        severity: 'due',
        daysLeft: 0,
        link: `/contacts/${todayLead.id}`,
      });
      expect(await feedItem('contactFollowUp', late.id)).toMatchObject({
        severity: 'overdue',
        subtitle: '053-345-6789',
      });
    });

    it('fine reassignment deadline (due, receivedAt + 90 days)', async () => {
      const car = await f.taxi();
      const fine = ok<Ref>(
        await s.api.post('/api/fines').send({
          vehicleId: car.id,
          fineNo: 'F-778',
          offenceAt: `${daysFromToday(-85)}T07:00:00.000Z`,
          receivedAt: daysFromToday(-80),
          amount: 250,
        }),
      );
      expect(await feedItem('fineReassign', fine.id)).toMatchObject({
        entityType: 'fine',
        dueAt: daysFromToday(10),
        severity: 'due',
        link: `/vehicles/${car.id}?tab=fines`,
      });
    });

    it('dealer registration (11 months) and taxi age / semi-annual dates', async () => {
      const registeredAt = addDays(addMonths(T, -11), 10);
      const stock = await f.taxi({ isTaxi: false, dealerRegisteredAt: registeredAt });
      const dueAt = addMonths(registeredAt, 11);
      expect(await feedItem('dealerRegistration', stock.id)).toMatchObject({
        entityType: 'vehicle',
        dueAt,
        severity: expected(dueAt, 30),
        link: `/vehicles/${stock.id}`,
      });

      const year = Number(T.slice(0, 4));
      const old = await f.taxi({ year: year - 12 });
      expect(await feedItem('taxiAge', old.id, 365)).toMatchObject({
        dueAt: `${year}-01-01`,
        severity: expected(`${year}-01-01`, 90),
        link: `/vehicles/${old.id}`,
      });
      const nine = await f.taxi({ year: year - 9 });
      expect(await feedItem('taxiSemiAnnual', nine.id, 365)).toMatchObject({
        dueAt: `${year + 1}-01-01`,
        severity: expected(`${year + 1}-01-01`, 90),
      });
    });
  });

  describe('exports: filters on the context sheet and the "no data" row', () => {
    it('profit groupBy and fines status filters are listed; an empty period says "no data"', async () => {
      const profit = await workbook(`/api/reports/profit?groupBy=quarter&format=xlsx&lang=he`);
      const values = new Map<string, unknown>();
      profit.worksheets[0]?.eachRow((row) => {
        const key = String(row.getCell(1).value);
        if (!values.has(key)) values.set(key, row.getCell(2).value);
      });
      expect(values.get(he('reports.params.groupBy'))).toBe(he('reports.groupBy.quarter'));

      const fines = await workbook(
        '/api/reports/fines?from=2020-01-01&to=2020-01-31&status=NEW,PAID_BY_US&format=xlsx&lang=he',
      );
      const [context, data] = fines.worksheets;
      const filters = new Map<string, unknown>();
      context?.eachRow((row) => {
        // First occurrence: the column list below repeats some labels.
        const key = String(row.getCell(1).value);
        if (!filters.has(key)) filters.set(key, row.getCell(2).value);
      });
      expect(filters.get(he('reports.params.status'))).toBe(
        `${he('enums.FineStatus.NEW')}, ${he('enums.FineStatus.PAID_BY_US')}`,
      );
      expect(filters.get(he('reports.context.rows'))).toBe('0');
      expect(data?.getCell('A2').value).toBe(he('reports.noData'));
      expect(data?.rowCount).toBe(2);
    });

    async function workbook(url: string): Promise<Workbook> {
      const res = await s.api.get(url).buffer(true).parse(binaryParser);
      expect(res.status).toBe(200);
      const bytes = res.body as Buffer;
      const wb = new Workbook();
      await wb.xlsx.load(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      );
      return wb;
    }
  });

  /* ------------------------------------------------------------------------------------ */
  /* PATCH /reminders                                                                      */
  /* ------------------------------------------------------------------------------------ */

  describe('PATCH /reminders/:id', () => {
    it('updates title / due date / notes and links or unlinks a record', async () => {
      const created = ok<Ref>(
        await s.api.post('/api/reminders').send({ title: 'לבדוק', dueAt: T }),
      );
      const car = await f.taxi();
      const patched = ok<Record<string, unknown>>(
        await s.api.patch(`/api/reminders/${created.id}`).send({
          title: 'לבדוק את הרכב',
          dueAt: daysFromToday(3),
          notes: 'שמן ומים',
          entityType: 'VEHICLE',
          entityId: car.id,
        }),
        200,
      );
      expect(patched).toMatchObject({
        title: 'לבדוק את הרכב',
        dueAt: daysFromToday(3),
        notes: 'שמן ומים',
        entityType: 'VEHICLE',
        entityId: car.id,
        link: `/vehicles/${car.id}`,
      });
      expect(await feedItem('manual', created.id)).toMatchObject({
        severity: 'upcoming',
        subtitle: 'שמן ומים',
        link: `/vehicles/${car.id}`,
      });
      // Changing only the id keeps the type (both still set).
      const other = await f.taxi();
      const moved = await s.api.patch(`/api/reminders/${created.id}`).send({ entityId: other.id });
      expect(moved.body).toMatchObject({ entityType: 'VEHICLE', entityId: other.id });
      const unlinked = await s.api
        .patch(`/api/reminders/${created.id}`)
        .send({ entityType: null, entityId: null });
      expect(unlinked.body).toMatchObject({ entityType: null, entityId: null, link: '/reminders' });
    });

    it('entityType and entityId: both or neither; the record must exist', async () => {
      const created = ok<Ref>(await s.api.post('/api/reminders').send({ title: 'x', dueAt: T }));
      expectError(
        await s.api.patch(`/api/reminders/${created.id}`).send({ entityType: 'DRIVER' }),
        400,
        'errors.validation',
        [{ path: 'entityId', message: 'validation.required' }],
      );
      expectError(
        await s.api.patch(`/api/reminders/${created.id}`).send({ entityId: 'abc123' }),
        400,
        'errors.validation',
        [{ path: 'entityType', message: 'validation.required' }],
      );
      expectError(
        await s.api
          .patch(`/api/reminders/${created.id}`)
          .send({ entityType: 'DRIVER', entityId: 'missing' }),
        404,
        'errors.notFound',
        [{ path: 'entityId', message: 'errors.notFound' }],
      );
      expectError(
        await s.api.post('/api/reminders').send({ title: 'y', dueAt: T, entityType: 'DEAL' }),
        400,
        'errors.validation',
        [{ path: 'entityId', message: 'validation.required' }],
      );
      expectError(
        await s.api.patch('/api/reminders/missing').send({ title: 'z' }),
        404,
        'errors.notFound',
      );
    });
  });

  /* ------------------------------------------------------------------------------------ */
  /* Backup status                                                                         */
  /* ------------------------------------------------------------------------------------ */

  describe('GET /settings/backup-status', () => {
    const file = process.env.BACKUP_STATUS_FILE as string;

    afterAll(() => rmSync(file, { force: true }));

    it('missing file -> ok false with nulls; recent -> ok; stale -> not ok', async () => {
      rmSync(file, { force: true });
      const missing = await s.api.get('/api/settings/backup-status');
      expect(missing.status).toBe(200);
      expect(missing.body).toEqual({ lastSuccessAt: null, lastFile: null, ok: false });

      mkdirSync(dirname(file), { recursive: true });
      const recent = new Date(Date.now() - 3 * 3_600_000).toISOString();
      writeFileSync(file, JSON.stringify({ lastSuccessAt: recent, lastFile: 'renawi.dump' }));
      const fresh = await s.api.get('/api/settings/backup-status');
      expect(BackupStatusSchema.safeParse(fresh.body).success).toBe(true);
      expect(fresh.body).toEqual({ lastSuccessAt: recent, lastFile: 'renawi.dump', ok: true });

      const stale = new Date(Date.now() - 40 * 3_600_000).toISOString();
      writeFileSync(file, JSON.stringify({ lastSuccessAt: stale, lastFile: 'old.dump' }));
      expect((await s.api.get('/api/settings/backup-status')).body).toMatchObject({ ok: false });
    });
  });
});
