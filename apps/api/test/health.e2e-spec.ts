import request from 'supertest';
import { createTestApp, resetDatabase, TestApp } from './utils';

describe('Health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('GET /api/health is public and reports the database as up', async () => {
    const res = await request(t.http).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up', time: expect.any(String) });
    expect(Number.isNaN(Date.parse(res.body.time))).toBe(false);
  });

  it('reports db "down" when the database query fails', async () => {
    const spy = jest
      .spyOn(t.prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('connection lost'));
    const res = await request(t.http).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'down' });
    spy.mockRestore();
  });

  it('unknown routes return 404 with an i18n key', async () => {
    const res = await request(t.http).get('/api/does-not-exist').expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'errors.notFound' });
  });

  it('allows the web origin with credentials and the X-Requested-With header (CORS)', async () => {
    const res = await request(t.http)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-requested-with')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain(
      'x-requested-with',
    );
  });
});
