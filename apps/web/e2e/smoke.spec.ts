import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * UI smoke: login -> dashboard -> switch language (RTL/LTR) -> toggle dark theme.
 * The API is mocked with page.route('/api/**') so the backend does not need to run; the mock
 * follows the auth contract (`{ user }` bodies, 401 `{ statusCode, message }`).
 */

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN';
  locale: 'he' | 'ar' | 'en';
  theme: 'light' | 'dark' | 'system';
}

interface MockApi {
  calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[];
  user: MockUser;
  settings: Record<string, unknown>;
}

async function mockApi(page: Page, options: { loggedIn?: boolean } = {}): Promise<MockApi> {
  const api: MockApi = {
    calls: [],
    settings: {
      businessName: { he: 'רנאוי מוטורס', ar: 'رناوي موتورز', en: 'Renawi Motors' },
      legalId: null,
      dealerLicenseNo: null,
      address: null,
      phone: null,
      email: null,
      vatRate: 18,
      logoDocumentId: null,
      updatedAt: '2026-11-07T08:00:00.000Z',
    },
    user: {
      id: 'usr_admin',
      email: 'admin@renawi.local',
      name: 'אליאס רנאוי',
      role: 'ADMIN',
      locale: 'he',
      theme: 'system',
    },
  };
  let loggedIn = options.loggedIn ?? false;

  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  const unauthorized = { statusCode: 401, message: 'errors.unauthorized' };

  await page.route('/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = request.postDataJSON() as unknown;
    api.calls.push({ method, path, body, headers: request.headers() });

    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = (body ?? {}) as { email?: string; password?: string };
      if (email === api.user.email && password === 'ChangeMe123!') {
        loggedIn = true;
        return json(route, 200, { user: api.user });
      }
      return json(route, 401, { statusCode: 401, message: 'auth.invalidCredentials' });
    }
    if (path === '/api/auth/refresh' && method === 'POST') {
      return loggedIn ? json(route, 200, { user: api.user }) : json(route, 401, unauthorized);
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      loggedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/auth/me') {
      if (!loggedIn) return json(route, 401, unauthorized);
      if (method === 'PATCH') api.user = { ...api.user, ...(body as Partial<MockUser>) };
      return json(route, 200, { user: api.user });
    }
    if (path === '/api/settings') {
      if (!loggedIn) return json(route, 401, unauthorized);
      if (method === 'PATCH') api.settings = { ...api.settings, ...(body as object) };
      return json(route, 200, api.settings);
    }
    return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
  });

  return api;
}

/**
 * Collect page errors, console errors and React/AntD deprecation warnings (the browser's own
 * "Failed to load resource" lines for the expected 401s are ignored).
 */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.startsWith('Failed to load resource')) {
      problems.push(`console.error: ${text}`);
    }
    if (msg.type() === 'warning' && /antd|deprecated|React/i.test(text)) {
      problems.push(`console.warn: ${text}`);
    }
  });
  return problems;
}

test('login, switch language and theme', async ({ page }) => {
  const api = await mockApi(page);

  const problems = watchConsole(page);

  await page.goto('/');

  // Not logged in: redirected to the login page, which is in Hebrew (the default) and RTL.
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // Wrong password: the API's i18n key is shown translated.
  await page.locator('input[name="email"]').fill('admin@renawi.local');
  await page.locator('input[name="password"]').fill('wrong-password1');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('alert')).toContainText('דוא״ל או סיסמה שגויים');

  await page.locator('input[name="password"]').fill('ChangeMe123!');
  await page.locator('button[type="submit"]').click();

  // Dashboard in the authenticated shell.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('לוח בקרה');
  await expect(page).toHaveTitle('לוח בקרה · רנאוי מוטורס');
  await expect(page.locator('.ant-statistic').first()).toBeVisible();

  // Every request carried the CSRF header.
  expect(api.calls.every((c) => c.headers['x-requested-with'] === 'XMLHttpRequest')).toBe(true);

  // English: left-to-right, side navigation on the left.
  await page.getByTestId('lang-menu').click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  const viewport = page.viewportSize();
  const ltrNav = await page.getByTestId('side-nav').boundingBox();
  expect(ltrNav && viewport && ltrNav.x + ltrNav.width / 2).toBeLessThan(
    (viewport?.width ?? 0) / 2,
  );

  // Arabic: right-to-left, side navigation on the right, Latin digits, preference saved.
  await page.getByTestId('lang-menu').click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('لوحة التحكم');
  const rtlNav = await page.getByTestId('side-nav').boundingBox();
  expect(rtlNav && viewport && rtlNav.x + rtlNav.width / 2).toBeGreaterThan(
    (viewport?.width ?? 0) / 2,
  );
  const kpiText = await page.locator('.ant-statistic-content').allInnerTexts();
  expect(kpiText.join(' ')).toMatch(/0/);
  expect(kpiText.join(' ')).not.toMatch(/[٠-٩]/);
  await expect
    .poll(() =>
      api.calls.some(
        (c) =>
          c.method === 'PATCH' && c.path === '/api/auth/me' && (c.body as MockUser).locale === 'ar',
      ),
    )
    .toBe(true);

  // Dark theme.
  const before = await page.locator('html').getAttribute('data-theme');
  await page.getByTestId('theme-toggle').click();
  const expected = before === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
  if (expected === 'light') {
    await page.getByTestId('theme-toggle').click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() =>
      api.calls.some((c) => c.method === 'PATCH' && (c.body as MockUser).theme === 'dark'),
    )
    .toBe(true);

  // Brand dark surfaces applied (tokens.css + AntD dark algorithm).
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(15, 15, 16)');

  // Settings sub-menu navigation in Arabic.
  await page.getByRole('menuitem', { name: 'الإعدادات' }).click();
  await page.getByRole('menuitem', { name: 'بيانات العمل' }).click();
  await expect(page).toHaveURL(/\/settings\/business$/);
  await expect(page).toHaveTitle('بيانات العمل · رناوي موتورز');
  await expect(page.locator('input[name="businessName.ar"]')).toHaveValue('رناوي موتورز');

  expect(problems).toEqual([]);
});

test('business settings load, validate and save', async ({ page }) => {
  const api = await mockApi(page, { loggedIn: true });
  const problems = watchConsole(page);
  await page.goto('/settings/business');

  // Session restored from GET /api/auth/me; the form is filled from GET /api/settings.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('פרטי העסק');
  const nameEn = page.locator('input[name="businessName.en"]');
  await expect(nameEn).toHaveValue('Renawi Motors');
  await expect(page.locator('input[name="businessName.he"]')).toHaveAttribute('dir', 'rtl');
  await expect(nameEn).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('input[name="phone"]')).toHaveAttribute('inputmode', 'tel');

  // Client-side validation with translated zod messages.
  await page.locator('input[name="email"]').fill('not-an-email');
  await page.locator('input[name="email"]').blur();
  await expect(page.getByText('כתובת דוא״ל לא תקינה')).toBeVisible();

  await page.locator('input[name="email"]').fill('Office@Renawi.co.il');
  await nameEn.fill('Renawi Motors Ltd');
  await page.locator('input[name="phone"]').fill('050-123-4567');
  await page.getByRole('button', { name: 'שמירה' }).click();
  await expect(page.getByText('נשמר בהצלחה')).toBeVisible();

  // PATCH carries the parsed schema output: trimmed, normalised, '' -> null.
  const patch = api.calls.find((c) => c.method === 'PATCH' && c.path === '/api/settings');
  expect(patch?.body).toMatchObject({
    businessName: { he: 'רנאוי מוטורס', ar: 'رناوي موتورز', en: 'Renawi Motors Ltd' },
    email: 'office@renawi.co.il',
    phone: '0501234567',
    legalId: null,
    vatRate: 18,
  });
  expect(problems).toEqual([]);
});
