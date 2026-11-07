import request from 'supertest';
import type { TestApp } from './utils';

/**
 * Login rate limit (production default 10/min per IP). The limit is lowered for this file
 * only; the app is imported after setting it because the config is read at import time.
 */
describe('Login throttling (e2e)', () => {
  let t: TestApp;
  const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

  beforeAll(async () => {
    process.env.LOGIN_THROTTLE_LIMIT = '3';
    const utils = await import('./utils');
    t = await utils.createTestApp();
    await utils.resetDatabase(t.prisma);
    await utils.createUser(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('returns 429 auth.tooManyAttempts after the limit and leaves other routes alone', async () => {
    const attempt = () =>
      request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: 'owner@renawi.test', password: 'Wrong-password1' });

    for (let i = 0; i < 3; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body).toEqual({ statusCode: 429, message: 'auth.tooManyAttempts' });

    await request(t.http).get('/api/health').expect(200);
    await request(t.http).post('/api/auth/refresh').set(XHR).expect(401);
  });
});
