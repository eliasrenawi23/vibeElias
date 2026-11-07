import { BUSINESS_NAME, SettingsResponseSchema } from '@renawi/shared';
import request from 'supertest';
import {
  accessCookie,
  createTestApp,
  createUser,
  login,
  resetDatabase,
  TestApp,
  XHR,
} from './utils';

describe('Settings (e2e)', () => {
  let t: TestApp;
  let cookie: string;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    await createUser(t.prisma);
    cookie = accessCookie((await login(t.http)).access);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('requires authentication', async () => {
    await request(t.http).get('/api/settings').expect(401);
  });

  it('GET returns the defaults with Decimal fields as numbers', async () => {
    const res = await request(t.http).get('/api/settings').set('Cookie', cookie).expect(200);

    expect(res.body.vatRate).toBe(18);
    expect(typeof res.body.vatRate).toBe('number');
    expect(res.body.businessName).toEqual(BUSINESS_NAME);
    expect(res.body.reminderLeadDays).toMatchObject({ insurance: 30, taxiPermit: 60, transfer: 2 });
    expect(res.body.defaultLeaseTerms.responsibilities).toEqual({
      insurance: 'DRIVER',
      test: 'DRIVER',
      repairs: 'DRIVER',
      fines: 'DRIVER',
    });
    expect(res.body.logoDocumentId).toBeNull();
    expect(res.body.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const parsed = SettingsResponseSchema.safeParse(res.body);
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it('PATCH without X-Requested-With is rejected with 403', async () => {
    const res = await request(t.http)
      .patch('/api/settings')
      .set('Cookie', cookie)
      .send({ vatRate: 17 })
      .expect(403);
    expect(res.body).toEqual({ statusCode: 403, message: 'errors.forbidden' });

    const row = await t.prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.vatRate.toNumber()).toBe(18);
  });

  it('PATCH applies a partial update, returns numbers and writes an audit row', async () => {
    const res = await request(t.http)
      .patch('/api/settings')
      .set(XHR)
      .set('Cookie', cookie)
      .send({ vatRate: 17.5, phone: '050-123-4567', dealerLicenseNo: 'DL-2026-0042' })
      .expect(200);

    expect(res.body).toMatchObject({
      vatRate: 17.5,
      phone: '0501234567',
      dealerLicenseNo: 'DL-2026-0042',
      businessName: BUSINESS_NAME,
    });
    expect(SettingsResponseSchema.safeParse(res.body).success).toBe(true);

    const again = await request(t.http).get('/api/settings').set('Cookie', cookie).expect(200);
    expect(again.body.vatRate).toBe(17.5);
    expect(again.body.phone).toBe('0501234567');

    const audit = await t.prisma.auditLog.findFirst({
      where: { entity: 'Settings', entityId: '1', action: 'UPDATE' },
      orderBy: { at: 'desc' },
    });
    expect(audit?.diff).toMatchObject({
      changes: {
        vatRate: { from: 18, to: 17.5 },
        phone: { from: null, to: '0501234567' },
      },
    });
  });

  it('PATCH replaces nested objects whole and fills their defaults', async () => {
    const res = await request(t.http)
      .patch('/api/settings')
      .set(XHR)
      .set('Cookie', cookie)
      .send({ reminderLeadDays: { insurance: 45 } })
      .expect(200);
    expect(res.body.reminderLeadDays).toMatchObject({
      insurance: 45,
      registration: 30,
      transfer: 2,
    });
  });

  it('PATCH returns i18n field errors for invalid values', async () => {
    const res = await request(t.http)
      .patch('/api/settings')
      .set(XHR)
      .set('Cookie', cookie)
      .send({ vatRate: 150, email: 'nope', reminderLeadDays: { insurance: -1 } })
      .expect(400);
    expect(res.body.message).toBe('errors.validation');
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { path: 'vatRate', message: 'validation.invalidPercent' },
        { path: 'email', message: expect.stringMatching(/^validation\./) },
        { path: 'reminderLeadDays.insurance', message: expect.stringMatching(/^validation\.min/) },
      ]),
    );
  });

  it('PATCH is ADMIN only', async () => {
    await createUser(t.prisma, { email: 'sales@renawi.test', role: 'SALES' });
    const sales = await login(t.http, 'sales@renawi.test');
    const res = await request(t.http)
      .patch('/api/settings')
      .set(XHR)
      .set('Cookie', accessCookie(sales.access))
      .send({ vatRate: 10 })
      .expect(403);
    expect(res.body).toEqual({ statusCode: 403, message: 'errors.forbidden' });
    // Reading is allowed for every role.
    await request(t.http)
      .get('/api/settings')
      .set('Cookie', accessCookie(sales.access))
      .expect(200);
  });
});
