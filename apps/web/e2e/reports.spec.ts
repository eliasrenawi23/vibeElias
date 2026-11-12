import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Milestone 5: dashboard (KPIs, expiring feed, SVG chart with Latin digits in Arabic) -> bell
 * popover -> reminders page severity filter -> add a manual reminder -> profit report with a
 * period preset -> export link -> reminder lead days saved. Every `/api/**` call is mocked with
 * `page.route` following the milestone-5 contract (docs/plans/m5-status-and-contract.md).
 */

/** Today in the business time zone, as the web app computes it. */
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const MONTH_START = `${TODAY.slice(0, 8)}01`;

type Json = Record<string, unknown>;

interface Call {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

const LEAD_DAYS = {
  registration: 30,
  insurance: 30,
  driverLicense: 60,
  taxiPermit: 60,
  medical: 60,
  taxiLicense: 60,
  lease: 30,
  document: 30,
  dealerRegistration: 30,
  transfer: 2,
  fine: 14,
  taxiAge: 90,
};

const FEED = [
  {
    id: 'vehicle:registration:veh_1',
    kind: 'vehicleRegistration',
    entityType: 'vehicle',
    entityId: 'veh_1',
    title: '12-345-67 Toyota Corolla',
    subtitle: null,
    dueAt: '2026-11-01',
    daysLeft: -4,
    severity: 'overdue',
    link: '/vehicles/veh_1',
  },
  {
    id: 'insurance:policy:ins_1',
    kind: 'insurance',
    entityType: 'insurance',
    entityId: 'ins_1',
    title: '23-456-78 Skoda Octavia',
    subtitle: 'Harel 778',
    dueAt: '2026-11-15',
    daysLeft: 3,
    severity: 'due',
    link: '/vehicles/veh_2?tab=insurance',
  },
  {
    id: 'reminder:manual:rem_1',
    kind: 'manual',
    entityType: 'reminder',
    entityId: 'rem_1',
    title: 'Call the garage',
    subtitle: null,
    dueAt: '2026-12-01',
    daysLeft: 19,
    severity: 'upcoming',
    link: '/reminders',
  },
];

const PROFIT_REPORT = {
  report: 'profit',
  params: { from: MONTH_START, to: TODAY, groupBy: 'month' },
  columns: [
    { key: 'period', label: 'reports.columns.period', type: 'text' },
    { key: 'salesRevenue', label: 'reports.columns.salesRevenue', type: 'money' },
    { key: 'purchaseCost', label: 'reports.columns.purchaseCost', type: 'money' },
    { key: 'expenses', label: 'reports.columns.expenses', type: 'money' },
    { key: 'vatOnMargin', label: 'reports.columns.vatOnMargin', type: 'money' },
    { key: 'commission', label: 'reports.columns.commission', type: 'money' },
    { key: 'leaseIncome', label: 'reports.columns.leaseIncome', type: 'money' },
    { key: 'profit', label: 'reports.columns.profit', type: 'money' },
  ],
  rows: [
    {
      period: TODAY.slice(0, 7),
      salesRevenue: 95000,
      purchaseCost: 78000,
      expenses: 3200,
      vatOnMargin: 2105.08,
      commission: null,
      leaseIncome: 14500,
      profit: 26194.92,
    },
  ],
  totals: {
    period: null,
    salesRevenue: 95000,
    purchaseCost: 78000,
    expenses: 3200,
    vatOnMargin: 2105.08,
    commission: null,
    leaseIncome: 14500,
    profit: 26194.92,
  },
};

function months(): Json[] {
  const [y, m] = TODAY.split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const profit = [
      8200, 12400, -3100, 15800, 9600, 21000, 18800, 7300, 11200, 16900, 12100, 14600,
    ][i];
    return {
      period,
      sales: 60000,
      leaseIncome: 12000 + i * 250,
      commission: 0,
      costs: 50000,
      profit,
    };
  });
}

async function mockApi(page: Page) {
  const calls: Call[] = [];
  let user = {
    id: 'usr_admin',
    email: 'admin@renawi.local',
    name: 'Elias Renawi',
    role: 'ADMIN',
    locale: 'en',
    theme: 'light',
  };
  let settings: Json = {
    businessName: { he: 'רינאוי מוטורס', ar: 'ريناوي موتورز', en: 'Renawi Motors' },
    legalId: null,
    dealerLicenseNo: null,
    address: null,
    phone: null,
    email: null,
    vatRate: 18,
    reminderLeadDays: { ...LEAD_DAYS },
    defaultLeaseTerms: {
      responsibilities: { insurance: 'DRIVER', test: 'DRIVER', repairs: 'DRIVER', fines: 'DRIVER' },
      clauses: { he: '', ar: '', en: '' },
    },
    logoDocumentId: null,
    updatedAt: '2026-11-01T08:00:00.000Z',
  };
  const reminders: Json[] = [
    {
      id: 'rem_1',
      title: 'Call the garage',
      dueAt: '2026-12-01',
      entityType: null,
      entityId: null,
      notes: null,
      doneAt: null,
      createdAt: '2026-11-01T08:00:00.000Z',
      link: '/reminders',
    },
  ];

  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });

  await page.route('/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({ method, path, search: url.search, body });

    if (path === '/api/auth/me' || path === '/api/auth/refresh') {
      if (method === 'PATCH') user = { ...user, ...(body as Json) };
      return json(route, 200, { user });
    }
    if (path === '/api/dashboard/kpis') {
      return json(route, 200, {
        vehiclesInStock: 7,
        activeLeases: 12,
        receivables: 18400,
        monthProfit: 14600,
        openDeals: 3,
        transfersOverdue: 1,
        expiring: { overdue: 1, due: 1 },
        finesOpen: 4,
        receivablesOverdue: 5200,
      });
    }
    if (path === '/api/dashboard/charts') {
      return json(route, 200, {
        profitByMonth: months(),
        receivablesAgeing: { current: 6400, d1_30: 5200, d31_60: 3100, d61_90: 0, d90_plus: 3700 },
        inventory: { inStock: 7, reserved: 2, leased: 12, consigned: 3 },
      });
    }
    if (path === '/api/dashboard/activity') {
      return json(route, 200, [
        {
          id: 'aud_1',
          at: '2026-11-12T07:30:00.000Z',
          userName: 'Elias Renawi',
          entity: 'Vehicle',
          entityId: 'veh_1',
          action: 'UPDATE',
          summary: 'Vehicle 12-345-67 status → LEASED',
          label: '12-345-67',
          changes: ['status'],
          link: '/vehicles/veh_1',
        },
      ]);
    }
    if (path === '/api/reminders/feed') {
      const severity = (url.searchParams.get('severity') ?? '').split(',').filter(Boolean);
      const kinds = (url.searchParams.get('kinds') ?? '').split(',').filter(Boolean);
      const byKind = FEED.filter((i) => kinds.length === 0 || kinds.includes(i.kind));
      const items = byKind.filter((i) => severity.length === 0 || severity.includes(i.severity));
      const count = (s: string) => byKind.filter((i) => i.severity === s).length;
      const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
      return json(route, 200, {
        items: items.slice(0, pageSize),
        total: items.length,
        page: 1,
        pageSize,
        counts: { overdue: count('overdue'), due: count('due'), upcoming: count('upcoming') },
      });
    }
    if (path === '/api/reminders' && method === 'GET') {
      const done = url.searchParams.get('done');
      const items = reminders.filter((r) => done !== 'false' || !r.doneAt);
      return json(route, 200, { items, total: items.length, page: 1, pageSize: 25 });
    }
    if (path === '/api/reminders' && method === 'POST') {
      const created = {
        id: `rem_${reminders.length + 1}`,
        entityType: null,
        entityId: null,
        notes: null,
        doneAt: null,
        createdAt: '2026-11-12T08:00:00.000Z',
        link: '/reminders',
        ...(body as Json),
      };
      reminders.push(created);
      return json(route, 201, created);
    }
    if (path === '/api/reports/profit') return json(route, 200, PROFIT_REPORT);
    if (path === '/api/settings' && method === 'GET') return json(route, 200, settings);
    if (path === '/api/settings' && method === 'PATCH') {
      settings = { ...settings, ...(body as Json), updatedAt: '2026-11-12T09:00:00.000Z' };
      return json(route, 200, settings);
    }
    // Backup monitoring not set up on this server.
    return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
  });

  return { calls };
}

/** Page errors, console errors and React/AntD warnings ("Failed to load resource" excluded). */
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

async function switchLanguage(page: Page, name: string, dir: 'rtl' | 'ltr') {
  // Retried as a whole: a click during the dropdown's opening animation can miss the item.
  await expect(async () => {
    await page.getByTestId('lang-menu').click();
    await page.getByRole('menuitem', { name }).click({ timeout: 2000 });
    await expect(page.locator('html')).toHaveAttribute('dir', dir, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test('dashboard, bell, reminders, profit report and lead days', async ({ page }) => {
  test.setTimeout(120_000);
  const api = await mockApi(page);
  const problems = watchConsole(page);
  const lastCall = (method: string, path: string) =>
    [...api.calls].reverse().find((c) => c.method === method && c.path === path);

  /* ---- Dashboard ---- */
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  const kpis = page.getByTestId('dashboard-kpis');
  await expect(kpis.getByTestId('kpi-vehiclesInStock')).toContainText('7');
  await expect(kpis.getByTestId('kpi-receivables')).toContainText('₪18,400');
  await expect(kpis.getByTestId('kpi-receivables-sub')).toContainText(/₪5,200\u2069? overdue/);
  await expect(kpis.getByTestId('kpi-monthProfit').locator('[data-profit]')).toHaveAttribute(
    'data-profit',
    'profit',
  );
  // Trend from the charts' last two months (12,100 -> 14,600).
  await expect(kpis.getByTestId('kpi-monthProfit')).toContainText(
    /Up \u2066?₪2,500\u2069? from last month/,
  );
  await expect(kpis.getByTestId('kpi-expiring')).toContainText('1');
  await expect(kpis.getByTestId('kpi-expiring-sub')).toContainText('1 due soon');
  await expect(kpis.getByTestId('kpi-expiring')).toHaveClass(/rm-kpi-alert/);
  await expect(kpis.getByTestId('kpi-finesOpen')).toContainText('4');
  await expect(page.getByTestId('dashboard-updated')).toContainText(/Last updated .*\d{2}:\d{2}/);

  // Expiring soon: grouped by severity, a link per record.
  const expiring = page.getByTestId('dashboard-expiring');
  await expect(expiring.getByTestId('feed-item')).toHaveCount(3);
  await expect(expiring.locator('[data-severity]').first()).toHaveAttribute(
    'data-severity',
    'overdue',
  );
  await expect(expiring.getByRole('link', { name: '12-345-67 Toyota Corolla' })).toHaveAttribute(
    'href',
    '/vehicles/veh_1',
  );
  await expect(expiring.getByText(/4\u2069? days overdue/)).toBeVisible();
  expect(
    api.calls.some(
      (c) =>
        c.path === '/api/reminders/feed' && new URLSearchParams(c.search).get('pageSize') === '8',
    ),
  ).toBe(true);

  // Charts: SVG plots with their legends; the recent activity is listed.
  const profitChart = page.getByTestId('chart-profit');
  await expect(profitChart.locator('svg.recharts-surface')).toBeVisible();
  await expect(profitChart.getByTestId('chart-legend')).toContainText('Lease income');
  await expect(page.getByTestId('chart-ageing').locator('svg.recharts-surface')).toBeVisible();
  await expect(page.getByTestId('chart-inventory').locator('.rm-segment')).toHaveCount(4);
  await expect(page.getByTestId('dashboard-activity').getByTestId('activity-item')).toContainText(
    'Updated Vehicle 12-345-67',
  );
  // The table twin of a chart.
  await profitChart.getByTestId('chart-view-toggle').getByTitle('Show as table').click();
  await expect(profitChart.getByTestId('profit-table')).toContainText('₪14,600');
  await profitChart.getByTestId('chart-view-toggle').getByTitle('Show as chart').click();

  // Arabic: right-to-left page, the chart keeps Latin digits.
  await switchLanguage(page, 'العربية', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('لوحة التحكم');
  const ticks = profitChart.locator('svg.recharts-surface text');
  await expect(ticks.first()).toBeVisible();
  // SVG text has no innerText: read the text content.
  const tickText = (await ticks.allTextContents()).join(' ');
  expect(tickText).toMatch(/[0-9]/);
  expect(tickText).not.toMatch(/[٠-٩۰-۹]/);
  const kpiText = await kpis.innerText();
  expect(kpiText).toMatch(/18,400/);
  expect(kpiText).not.toMatch(/[٠-٩۰-۹]/);
  await switchLanguage(page, 'English', 'ltr');

  /* ---- Bell ---- */
  const bell = page.getByTestId('reminders-bell');
  await expect(bell).toHaveAttribute('data-count', '2');
  await expect(bell).toHaveAccessibleName('Reminders: 2 need attention');
  await bell.click();
  const panel = page.getByTestId('bell-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('feed-item')).toHaveCount(2);
  await expect(panel).toContainText('Harel 778');
  const bellCall = api.calls.find(
    (c) => c.path === '/api/reminders/feed' && new URLSearchParams(c.search).has('severity'),
  );
  expect(new URLSearchParams(bellCall?.search).get('severity')).toBe('overdue,due');
  await panel.getByTestId('bell-see-all').click();

  /* ---- Reminders page: severity filter ---- */
  await expect(page).toHaveURL(/\/reminders$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reminders');
  const feedTable = page.getByTestId('feed-table');
  await expect(feedTable.locator('tbody tr.ant-table-row')).toHaveCount(3);
  await expect(page.getByTestId('chip-severity-overdue')).toContainText('Overdue 1');
  await page.getByTestId('chip-severity-overdue').click();
  await expect(page).toHaveURL(/severity=overdue/);
  await expect(feedTable.locator('tbody tr.ant-table-row')).toHaveCount(1);
  await expect(feedTable).toContainText('Toyota Corolla');
  const filtered = lastCall('GET', '/api/reminders/feed');
  expect(new URLSearchParams(filtered?.search).get('severity')).toBe('overdue');
  expect(new URLSearchParams(filtered?.search).get('days')).toBe('30');

  /* ---- Manual reminder ---- */
  await page.getByRole('tab', { name: 'Manual reminders' }).click();
  await expect(page).toHaveURL(/tab=manual/);
  await expect(page.getByTestId('reminders-table')).toContainText('Call the garage');
  expect(new URLSearchParams(lastCall('GET', '/api/reminders')?.search).get('done')).toBe('false');
  await page.getByTestId('reminder-add').click();
  const dialog = page.getByRole('dialog', { name: 'New reminder' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Title').fill('Collect the deposit cheque');
  await dialog.getByLabel('Notes').fill('From Rami, at the office');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Reminder added')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(lastCall('POST', '/api/reminders')?.body).toEqual({
    title: 'Collect the deposit cheque',
    dueAt: TODAY,
    notes: 'From Rami, at the office',
  });
  await expect(page.getByTestId('reminders-table')).toContainText('Collect the deposit cheque');

  /* ---- Profit report with a period preset ---- */
  await page.getByTestId('side-nav').getByRole('menuitem', { name: 'Reports' }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByTestId('report-index').getByRole('link')).toHaveCount(7);
  await page.getByTestId('report-card-profit').click();
  await expect(page).toHaveURL(/\/reports\/profit$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Profit');
  await page.getByTestId('preset-thisMonth').click();
  await expect(page).toHaveURL(new RegExp(`from=${MONTH_START}&to=${TODAY}`));
  await expect(page.getByTestId('preset-thisMonth')).toHaveClass(/ant-tag-checkable-checked/);
  await expect
    .poll(() => {
      const call = lastCall('GET', '/api/reports/profit');
      return call ? Object.fromEntries(new URLSearchParams(call.search)) : null;
    })
    .toEqual({ from: MONTH_START, to: TODAY, format: 'json' });
  const report = page.getByTestId('report-table');
  await expect(report).toContainText('₪26,194.92');
  // A missing commission is "n/a", never 0.
  await expect(report.locator('tbody [data-na]')).toHaveCount(1);
  await expect(page.getByTestId('report-totals')).toContainText('Total');
  await expect(
    page.getByTestId('report-profit-chart').locator('svg.recharts-surface'),
  ).toBeVisible();
  const csv = new URL(
    (await page.getByTestId('report-export-csv').getAttribute('href')) ?? '',
    'http://localhost',
  );
  expect(csv.pathname).toBe('/api/reports/profit');
  expect(Object.fromEntries(csv.searchParams)).toEqual({
    from: MONTH_START,
    to: TODAY,
    format: 'csv',
    lang: 'en',
  });
  const xlsx = await page.getByTestId('report-export-xlsx').getAttribute('href');
  expect(xlsx).toContain('format=xlsx');

  /* ---- Reminder lead days ---- */
  await page.goto('/settings/reminders');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reminder timing');
  const registration = page.getByLabel('Vehicle licence (annual test)');
  await expect(registration).toHaveValue('30');
  await registration.fill('45');
  await page.getByTestId('lead-days-save').click();
  await expect(page.getByText('Saved successfully')).toBeVisible();
  expect(lastCall('PATCH', '/api/settings')?.body).toEqual({
    reminderLeadDays: { ...LEAD_DAYS, registration: 45 },
  });

  /* ---- Backup status: not set up on this server ---- */
  await page.getByTestId('side-nav').getByRole('menuitem', { name: 'Backup' }).click();
  await expect(page.getByTestId('backup-not-configured')).toContainText(
    'Backup monitoring is not set up on this server',
  );

  expect(problems).toEqual([]);
});
