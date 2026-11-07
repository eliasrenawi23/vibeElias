import { AuthSessionSchema } from '@renawi/shared';
import request from 'supertest';
import {
  accessCookie,
  createTestApp,
  createUser,
  login,
  refreshCookie,
  resetDatabase,
  setCookies,
  TEST_USER,
  TestApp,
  XHR,
} from './utils';

describe('Auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await resetDatabase(t.prisma);
    await createUser(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  describe('POST /api/auth/login', () => {
    it('returns the user and sets both httpOnly cookies', async () => {
      const res = await request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: `  ${TEST_USER.email.toUpperCase()} `, password: TEST_USER.password })
        .expect(200);

      expect(res.body).toEqual({
        user: {
          id: expect.any(String),
          email: TEST_USER.email,
          name: TEST_USER.name,
          role: 'ADMIN',
          locale: 'he',
          theme: 'system',
        },
      });
      expect(AuthSessionSchema.safeParse(res.body).success).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');

      const cookies = setCookies(res);
      expect(cookies.rm_access?.value).toBeTruthy();
      expect(cookies.rm_access?.attributes).toMatchObject({
        path: '/',
        httponly: '',
        samesite: 'Lax',
        'max-age': '900',
      });
      expect(cookies.rm_refresh?.value).toBeTruthy();
      expect(cookies.rm_refresh?.attributes).toMatchObject({
        path: '/api/auth',
        httponly: '',
        samesite: 'Lax',
        'max-age': String(30 * 24 * 3600),
      });
      // COOKIE_SECURE=false in tests.
      expect(cookies.rm_access?.attributes).not.toHaveProperty('secure');
    });

    it('rejects a wrong password with 401 auth.invalidCredentials and no cookies', async () => {
      const res = await request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: TEST_USER.email, password: 'Wrong-password1' })
        .expect(401);
      expect(res.body).toEqual({ statusCode: 401, message: 'auth.invalidCredentials' });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('rejects an unknown e-mail exactly like a wrong password', async () => {
      const res = await request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: 'nobody@renawi.test', password: TEST_USER.password })
        .expect(401);
      expect(res.body).toEqual({ statusCode: 401, message: 'auth.invalidCredentials' });
    });

    it('returns 400 with i18n field errors for an invalid body', async () => {
      const res = await request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: 'not-an-email' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'errors.validation',
        errors: expect.arrayContaining([
          { path: 'email', message: 'validation.invalidEmail' },
          { path: 'password', message: 'validation.required' },
        ]),
      });
    });

    it('rejects a login without X-Requested-With (403)', async () => {
      const res = await request(t.http)
        .post('/api/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(403);
      expect(res.body).toEqual({ statusCode: 403, message: 'errors.forbidden' });
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without a cookie', async () => {
      const res = await request(t.http).get('/api/auth/me').expect(401);
      expect(res.body).toEqual({ statusCode: 401, message: 'errors.unauthorized' });
    });

    it('returns 401 for a forged access token', async () => {
      await request(t.http)
        .get('/api/auth/me')
        .set('Cookie', accessCookie('abc.def.ghi'))
        .expect(401);
    });

    it('returns the user with a valid access cookie', async () => {
      const { access } = await login(t.http);
      const res = await request(t.http)
        .get('/api/auth/me')
        .set('Cookie', accessCookie(access))
        .expect(200);
      expect(res.body.user).toMatchObject({ email: TEST_USER.email, role: 'ADMIN' });
      expect(res.body.user).not.toHaveProperty('tokenVersion');
    });

    it('does not accept the refresh token as an access token', async () => {
      const { refresh } = await login(t.http);
      await request(t.http).get('/api/auth/me').set('Cookie', accessCookie(refresh)).expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the refresh cookie and rejects the old one', async () => {
      const first = await login(t.http);

      const rotated = await request(t.http)
        .post('/api/auth/refresh')
        .set(XHR)
        .set('Cookie', refreshCookie(first.refresh))
        .expect(200);
      expect(rotated.body.user.email).toBe(TEST_USER.email);
      const cookies = setCookies(rotated);
      const newRefresh = cookies.rm_refresh?.value as string;
      const newAccess = cookies.rm_access?.value as string;
      expect(newRefresh).toBeTruthy();
      expect(newRefresh).not.toBe(first.refresh);
      expect(cookies.rm_refresh?.attributes.path).toBe('/api/auth');

      await request(t.http).get('/api/auth/me').set('Cookie', accessCookie(newAccess)).expect(200);

      const replay = await request(t.http)
        .post('/api/auth/refresh')
        .set(XHR)
        .set('Cookie', refreshCookie(first.refresh))
        .expect(401);
      expect(replay.body).toEqual({ statusCode: 401, message: 'auth.sessionExpired' });

      // The rotated token is still good (once).
      await request(t.http)
        .post('/api/auth/refresh')
        .set(XHR)
        .set('Cookie', refreshCookie(newRefresh))
        .expect(200);
    });

    it('returns 401 without a refresh cookie', async () => {
      const res = await request(t.http).post('/api/auth/refresh').set(XHR).expect(401);
      expect(res.body).toEqual({ statusCode: 401, message: 'auth.sessionExpired' });
    });

    it('returns 401 when an access token is sent as the refresh cookie', async () => {
      const { access } = await login(t.http);
      await request(t.http)
        .post('/api/auth/refresh')
        .set(XHR)
        .set('Cookie', refreshCookie(access))
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204, clears both cookies and invalidates the session', async () => {
      const { access, refresh } = await login(t.http);
      const before = await t.prisma.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });

      const res = await request(t.http)
        .post('/api/auth/logout')
        .set(XHR)
        .set('Cookie', [accessCookie(access), refreshCookie(refresh)])
        .expect(204);
      expect(res.text).toBe('');

      const cookies = setCookies(res);
      expect(cookies.rm_access?.value).toBe('');
      expect(cookies.rm_access?.attributes.path).toBe('/');
      expect(cookies.rm_access?.attributes.expires).toContain('1970');
      expect(cookies.rm_refresh?.value).toBe('');
      expect(cookies.rm_refresh?.attributes.path).toBe('/api/auth');

      const after = await t.prisma.user.findUniqueOrThrow({ where: { email: TEST_USER.email } });
      expect(after.tokenVersion).toBe(before.tokenVersion + 1);

      await request(t.http).get('/api/auth/me').set('Cookie', accessCookie(access)).expect(401);
      await request(t.http)
        .post('/api/auth/refresh')
        .set(XHR)
        .set('Cookie', refreshCookie(refresh))
        .expect(401);
    });

    it('is idempotent without cookies', async () => {
      await request(t.http).post('/api/auth/logout').set(XHR).expect(204);
    });
  });

  describe('PATCH /api/auth/me', () => {
    it('updates locale and theme and writes an audit row', async () => {
      const { access } = await login(t.http);
      const res = await request(t.http)
        .patch('/api/auth/me')
        .set(XHR)
        .set('Cookie', accessCookie(access))
        .send({ locale: 'ar', theme: 'dark' })
        .expect(200);
      expect(res.body.user).toMatchObject({ locale: 'ar', theme: 'dark' });

      const audit = await t.prisma.auditLog.findFirst({
        where: { entity: 'User', entityId: res.body.user.id, action: 'UPDATE' },
        orderBy: { at: 'desc' },
      });
      expect(audit?.userId).toBe(res.body.user.id);
      expect(audit?.diff).toMatchObject({
        changes: { locale: { from: 'he', to: 'ar' }, theme: { from: 'system', to: 'dark' } },
      });
      expect(JSON.stringify(audit?.diff)).not.toContain('passwordHash');
    });

    it('rejects an unsupported locale with a field error', async () => {
      const { access } = await login(t.http);
      const res = await request(t.http)
        .patch('/api/auth/me')
        .set(XHR)
        .set('Cookie', accessCookie(access))
        .send({ locale: 'fr' })
        .expect(400);
      expect(res.body.errors).toEqual([{ path: 'locale', message: 'validation.invalidOption' }]);
    });

    it('requires currentPassword for a password change', async () => {
      const { access } = await login(t.http);
      const res = await request(t.http)
        .patch('/api/auth/me')
        .set(XHR)
        .set('Cookie', accessCookie(access))
        .send({ newPassword: 'NewSecret456' })
        .expect(400);
      expect(res.body.errors).toEqual([
        { path: 'currentPassword', message: 'validation.currentPasswordRequired' },
      ]);
    });

    it('rejects a wrong current password', async () => {
      const { access } = await login(t.http);
      const res = await request(t.http)
        .patch('/api/auth/me')
        .set(XHR)
        .set('Cookie', accessCookie(access))
        .send({ currentPassword: 'not-it-1', newPassword: 'NewSecret456' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'errors.validation',
        errors: [{ path: 'currentPassword', message: 'auth.invalidCredentials' }],
      });
    });

    it('changes the password, keeps this device logged in and ends other sessions', async () => {
      const otherDevice = await login(t.http);
      const thisDevice = await login(t.http);

      const res = await request(t.http)
        .patch('/api/auth/me')
        .set(XHR)
        .set('Cookie', accessCookie(thisDevice.access))
        .send({ currentPassword: TEST_USER.password, newPassword: 'NewSecret456' })
        .expect(200);
      const fresh = setCookies(res);
      expect(fresh.rm_access?.value).toBeTruthy();
      expect(fresh.rm_refresh?.value).toBeTruthy();

      await request(t.http)
        .get('/api/auth/me')
        .set('Cookie', accessCookie(fresh.rm_access?.value as string))
        .expect(200);
      await request(t.http)
        .get('/api/auth/me')
        .set('Cookie', accessCookie(otherDevice.access))
        .expect(401);

      await request(t.http)
        .post('/api/auth/login')
        .set(XHR)
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(401);
      await login(t.http, TEST_USER.email, 'NewSecret456');
    });
  });
});
