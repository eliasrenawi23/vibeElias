import {
  DashboardChartsSchema,
  DashboardKpisSchema,
  RemindersFeedSchema,
  ReminderSchema,
  ReportResultSchema,
} from '@renawi/shared';
import { Workbook } from 'exceljs';
import { Factory } from './factories';
import { binaryParser, daysFromToday, Session, startSession } from './helpers';

/** Smoke coverage of the milestone 5 endpoints (reminders, dashboard, reports). */
describe('Milestone 5: reminders, dashboard, reports (e2e)', () => {
  let s: Session;
  let f: Factory;

  beforeAll(async () => {
    s = await startSession();
    f = new Factory(s, 9);
    await f.taxi({ registrationExpiry: daysFromToday(-3) });
    await f.taxi({ registrationExpiry: daysFromToday(10) });
    await f.taxi({ registrationExpiry: daysFromToday(45) });
  });

  afterAll(async () => {
    await s.t.app.close();
  });

  it('feed: kinds, severities, counts, pagination', async () => {
    const res = await s.api.get('/api/reminders/feed?days=60&kinds=vehicleRegistration');
    expect(res.status).toBe(200);
    expect(RemindersFeedSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.counts).toEqual({ overdue: 1, due: 1, upcoming: 1 });
    expect(res.body.items.map((i: { severity: string }) => i.severity)).toEqual([
      'overdue',
      'due',
      'upcoming',
    ]);
    const page = await s.api.get(
      '/api/reminders/feed?days=60&kinds=vehicleRegistration&pageSize=1&page=2',
    );
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(3);
    const due = await s.api.get('/api/reminders/feed?kinds=vehicleRegistration&severity=due');
    expect(due.body.total).toBe(1);
  });

  it('manual reminders: create, done, undone, delete', async () => {
    const created = await s.api
      .post('/api/reminders')
      .send({ title: 'להתקשר לקונה', dueAt: daysFromToday(1) });
    expect(created.status).toBe(201);
    expect(ReminderSchema.safeParse(created.body).success).toBe(true);
    const id = created.body.id as string;
    const feed = await s.api.get('/api/reminders/feed?kinds=manual');
    expect(feed.body.items[0]).toMatchObject({ id: `manual:${id}`, entityType: 'reminder' });
    const done = await s.api.post(`/api/reminders/${id}/done`);
    expect(done.status).toBe(200);
    expect(done.body.doneAt).toEqual(expect.any(String));
    expect((await s.api.get('/api/reminders/feed?kinds=manual')).body.total).toBe(0);
    expect((await s.api.post(`/api/reminders/${id}/undone`)).body.doneAt).toBeNull();
    expect((await s.api.get('/api/reminders?done=false')).body.total).toBe(1);
    expect((await s.api.del(`/api/reminders/${id}`)).status).toBe(204);
    expect((await s.api.get(`/api/reminders/${id}`)).status).toBe(404);
  });

  it('dashboard: kpis, activity, charts', async () => {
    const kpis = await s.api.get('/api/dashboard/kpis');
    expect(DashboardKpisSchema.safeParse(kpis.body).success).toBe(true);
    const activity = await s.api.get('/api/dashboard/activity?limit=5');
    expect(activity.status).toBe(200);
    expect(activity.body.length).toBeGreaterThan(0);
    expect(activity.body[0]).toMatchObject({ summary: expect.any(String) });
    const charts = await s.api.get('/api/dashboard/charts?months=6');
    expect(DashboardChartsSchema.safeParse(charts.body).success).toBe(true);
    expect(charts.body.profitByMonth).toHaveLength(6);
  });

  const REPORTS = [
    'profit',
    'inventory-ageing',
    'receivables',
    'expenses',
    'lease-income?groupBy=license',
    'trade-book',
    'fines',
  ];

  it.each(REPORTS)('report %s: json, csv, xlsx', async (name) => {
    const sep = name.includes('?') ? '&' : '?';
    const json = await s.api.get(`/api/reports/${name}`);
    expect(json.status).toBe(200);
    expect(ReportResultSchema.safeParse(json.body).success).toBe(true);

    const csv = await s.api
      .get(`/api/reports/${name}${sep}format=csv&lang=he`)
      .buffer(true)
      .parse(binaryParser);
    expect(csv.status).toBe(200);
    const body = csv.body as Buffer;
    expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(body.toString('utf8')).toContain('\r\n');
    expect(String(csv.headers['content-disposition'])).toMatch(/renawi-.*\.csv/);

    const xlsx = await s.api
      .get(`/api/reports/${name}${sep}format=xlsx&lang=he`)
      .buffer(true)
      .parse(binaryParser);
    expect(xlsx.status).toBe(200);
    const wb = new Workbook();
    const bytes = xlsx.body as Buffer;
    await wb.xlsx.load(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    expect(wb.worksheets).toHaveLength(2);
    expect(wb.worksheets[1]?.views[0]?.rightToLeft).toBe(true);
  });
});
