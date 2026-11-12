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
  calls: {
    method: string;
    path: string;
    search: string;
    body: unknown;
    headers: Record<string, string>;
  }[];
  user: MockUser;
  settings: Record<string, unknown>;
  /** Current password of the mocked account (changed by PATCH /auth/me). */
  password: string;
  /** `GET /settings/backup-status` body (null = 404, monitoring not set up). */
  backup: Record<string, unknown> | null;
}

async function mockApi(page: Page, options: { loggedIn?: boolean } = {}): Promise<MockApi> {
  const api: MockApi = {
    calls: [],
    password: 'ChangeMe123!',
    backup: null,
    settings: {
      businessName: { he: 'רינאוי מוטורס', ar: 'ريناوي موتورز', en: 'Renawi Motors' },
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
      name: 'אליאס רינאוי',
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
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postDataJSON() as unknown;
    api.calls.push({ method, path, search: url.search, body, headers: request.headers() });

    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = (body ?? {}) as { email?: string; password?: string };
      if (email === api.user.email && password === api.password) {
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
      if (method === 'PATCH') {
        const { currentPassword, newPassword, ...prefs } = (body ?? {}) as Partial<MockUser> & {
          currentPassword?: string;
          newPassword?: string;
        };
        if (newPassword !== undefined) {
          // Same contract as the API: a wrong current password is a field error on it.
          if (currentPassword !== api.password) {
            return json(route, 400, {
              statusCode: 400,
              message: 'errors.validation',
              errors: [{ path: 'currentPassword', message: 'auth.invalidCredentials' }],
            });
          }
          api.password = newPassword;
        }
        api.user = { ...api.user, ...prefs };
      }
      return json(route, 200, { user: api.user });
    }
    // Dashboard KPIs: stock, leases, receivables, month profit, open deals, overdue transfers.
    if (path === '/api/dashboard/kpis' && method === 'GET') {
      if (!loggedIn) return json(route, 401, unauthorized);
      return json(route, 200, {
        vehiclesInStock: 4,
        activeLeases: 2,
        receivables: 1800,
        monthProfit: 12500,
        openDeals: 3,
        transfersOverdue: 1,
      });
    }
    if (path === '/api/settings/backup-status' && method === 'GET') {
      if (!loggedIn) return json(route, 401, unauthorized);
      return api.backup
        ? json(route, 200, api.backup)
        : json(route, 404, { statusCode: 404, message: 'errors.notFound' });
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
  await expect(page).toHaveTitle('לוח בקרה · רינאוי מוטורס');
  await expect(page.locator('.ant-statistic').first()).toBeVisible();
  // Live KPIs, all six from `GET /dashboard/kpis`; the month profit is coloured as a profit.
  await expect(page.locator('.ant-statistic-content').first()).toHaveText('4');
  await expect(page.locator('.ant-statistic-content').nth(1)).toHaveText('2');
  await expect(page.locator('.ant-statistic-content').nth(2)).toContainText('1,800');
  await expect(page.getByTestId('kpi-monthProfit').locator('[data-profit]')).toHaveAttribute(
    'data-profit',
    'profit',
  );
  await expect(page.getByTestId('kpi-monthProfit')).toContainText('12,500');
  await expect(page.getByTestId('kpi-openDeals')).toContainText('3');
  await expect(page.getByTestId('kpi-transfersOverdue')).toContainText('1');
  await expect(page.getByTestId('kpi-transfersOverdue')).toHaveClass(/rm-kpi-alert/);
  expect(api.calls.some((c) => c.method === 'GET' && c.path === '/api/dashboard/kpis')).toBe(true);

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
  await expect(page).toHaveTitle('بيانات العمل · ريناوي موتورز');
  await expect(page.locator('input[name="businessName.ar"]')).toHaveValue('ريناوي موتورز');

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
    businessName: { he: 'רינאוי מוטורס', ar: 'ريناوي موتورز', en: 'Renawi Motors Ltd' },
    email: 'office@renawi.co.il',
    phone: '0501234567',
    legalId: null,
    vatRate: 18,
  });
  expect(problems).toEqual([]);
});

test('account page: change the password from the user menu', async ({ page }) => {
  const api = await mockApi(page, { loggedIn: true });
  const problems = watchConsole(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('לוח בקרה');

  // User menu -> My account.
  await page.getByRole('button', { name: 'תפריט משתמש' }).click();
  await page.getByRole('menuitem', { name: 'החשבון שלי' }).click();
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('החשבון שלי');
  await expect(page.getByTestId('account-profile')).toContainText('אליאס רינאוי');
  await expect(page.getByTestId('account-profile')).toContainText('admin@renawi.local');
  await expect(page.getByTestId('change-password-note')).toContainText('יתנתקו');

  const current = page.locator('input[name="currentPassword"]');
  const next = page.locator('input[name="newPassword"]');
  const confirm = page.locator('input[name="confirmPassword"]');

  // Confirmation differs: caught before any request.
  await current.fill('ChangeMe123!');
  await next.fill('NewSecret456');
  await confirm.fill('NewSecret457');
  await page.getByTestId('change-password-submit').click();
  await expect(page.getByText('הסיסמאות אינן תואמות')).toBeVisible();
  expect(api.calls.some((c) => c.method === 'PATCH' && c.path === '/api/auth/me')).toBe(false);

  // Wrong current password: the API's field error is shown on that field.
  await current.fill('Wrong-pass1');
  await confirm.fill('NewSecret456');
  await page.getByTestId('change-password-submit').click();
  await expect(page.getByText('הסיסמה הנוכחית שגויה')).toBeVisible();
  await expect(current).toHaveAttribute('aria-invalid', 'true');

  // Right password: changed, the form is cleared.
  await current.fill('ChangeMe123!');
  await page.getByTestId('change-password-submit').click();
  await expect(page.getByText('הסיסמה הוחלפה. המכשירים האחרים נותקו.')).toBeVisible();
  await expect(current).toHaveValue('');
  const patches = api.calls.filter((c) => c.method === 'PATCH' && c.path === '/api/auth/me');
  expect(patches.at(-1)?.body).toEqual({
    currentPassword: 'ChangeMe123!',
    newPassword: 'NewSecret456',
  });
  expect(api.password).toBe('NewSecret456');
  expect(problems).toEqual([]);
});

test('backup page warns when the backups stay on the server only', async ({ page }) => {
  const api = await mockApi(page, { loggedIn: true });
  const problems = watchConsole(page);
  const recent = new Date(Date.now() - 3 * 3_600_000).toISOString();
  api.backup = {
    lastSuccessAt: recent,
    lastFile: 'db-20261112-0230.dump',
    ok: true,
    offsite: false,
    remote: null,
  };
  await page.goto('/settings/backup');
  const card = page.getByTestId('backup-status');
  await expect(card).toHaveAttribute('data-state', 'localOnly');
  await expect(page.getByTestId('backup-alert')).toHaveClass(/ant-alert-warning/);
  await expect(page.getByTestId('backup-alert')).toContainText('לא מוגן מפני אובדן השרת');
  await expect(card.locator('[data-offsite="false"]')).toBeVisible();

  // Copied to the bucket: green, with the bucket shown.
  api.backup = { ...api.backup, offsite: true, remote: 's3:renawi-backups/renawi/' };
  await page.getByTestId('backup-refresh').click();
  await expect(card).toHaveAttribute('data-state', 'ok');
  await expect(page.getByTestId('backup-alert')).toHaveClass(/ant-alert-success/);
  await expect(card).toContainText('s3:renawi-backups/renawi/');
  expect(problems).toEqual([]);
});
