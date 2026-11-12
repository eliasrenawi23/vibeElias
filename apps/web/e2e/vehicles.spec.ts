import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Vehicles: list -> vehicle page -> add expense -> add odometer reading -> documents tab ->
 * new vehicle -> Arabic list with an unmirrored plate. Every `/api/**` call is mocked with
 * `page.route` following the API contract (`{ items, total, page, pageSize }` lists, i18n-key
 * errors), so the backend does not need to run.
 */

/** 1x1 PNG served as the document thumbnail and file. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Today in the business time zone, as the web app computes it. */
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

type Json = Record<string, unknown>;

interface Call {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

function baseVehicle(over: Json): Json {
  return {
    vin: null,
    trim: null,
    color: null,
    fuel: null,
    gearbox: null,
    engineCc: null,
    hand: null,
    isTaxi: false,
    status: 'IN_STOCK',
    ownership: 'OWNED',
    ownerDriverId: null,
    currentKm: null,
    registrationExpiry: null,
    dealerRegisteredAt: null,
    meterSerial: null,
    meterSealedAt: null,
    location: null,
    listingPrice: null,
    notes: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    registeredLicense: null,
    ownerDriver: null,
    openCycle: null,
    alerts: [],
    cycles: [],
    insurance: [],
    odometer: [],
    expenseSummary: { cycleId: null, total: 0, paidByUs: 0, count: 0, byCategory: [] },
    documentCount: 0,
    ...over,
  };
}

async function mockApi(page: Page) {
  const calls: Call[] = [];
  let user = {
    id: 'usr_admin',
    email: 'admin@renawi.local',
    name: 'אליאס רינאוי',
    role: 'ADMIN',
    locale: 'en',
    theme: 'light',
  };
  const vehicles = new Map<string, Json>();
  vehicles.set(
    'veh_1',
    baseVehicle({
      id: 'veh_1',
      plateNo: '12345678',
      vin: 'JTDBR32E720123456',
      make: 'Toyota',
      model: 'Corolla',
      trim: 'Sun',
      year: 2021,
      color: 'לבן',
      fuel: 'HYBRID',
      gearbox: 'AUTO',
      hand: 2,
      currentKm: 84500,
      registrationExpiry: '2027-03-01',
      dealerRegisteredAt: '2026-10-01',
      location: 'מגרש ראשי',
      listingPrice: 89000,
      openCycle: { id: 'cyc_1', kind: 'OWNED', startedAt: '2026-10-01' },
      cycles: [
        {
          id: 'cyc_1',
          kind: 'OWNED',
          startedAt: '2026-10-01',
          endedAt: null,
          endReason: null,
          consignorId: null,
          consignor: null,
          askingPrice: null,
          minNetToConsignor: null,
          commissionMode: null,
          commissionValue: null,
          agreementEndsAt: null,
          expenseTotal: 1200,
          expensePaidByUs: 1200,
        },
      ],
      odometer: [{ id: 'odo_1', km: 84500, date: '2026-10-01', source: 'מסירה' }],
      expenseSummary: {
        cycleId: 'cyc_1',
        total: 1200,
        paidByUs: 1200,
        count: 1,
        byCategory: [{ category: 'REPAIR', total: 1200 }],
      },
      documentCount: 1,
    }),
  );
  const expenses: Json[] = [
    {
      id: 'exp_1',
      vehicleId: 'veh_1',
      cycleId: 'cyc_1',
      category: 'REPAIR',
      date: '2026-10-05',
      amount: 1200,
      vatIncluded: true,
      vatReclaimable: true,
      paidBy: 'US',
      vendorId: null,
      vendor: null,
      description: 'החלפת רפידות',
    },
  ];
  const documents = [
    {
      id: 'doc_1',
      kind: 'PHOTO',
      fileName: 'front.png',
      mime: 'image/png',
      size: PNG.length,
      hasThumb: true,
      title: 'Front view',
      lang: null,
      expiresAt: null,
      createdAt: '2026-10-02T08:00:00.000Z',
      url: '/api/documents/doc_1/file',
      thumbUrl: '/api/documents/doc_1/thumb',
    },
  ];

  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  const listItem = (v: Json) => {
    const {
      cycles: _c,
      insurance: _i,
      odometer: _o,
      expenseSummary: _e,
      documentCount: _d,
      ...item
    } = v;
    return item;
  };

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
    if (path === '/api/vehicles' && method === 'GET') {
      const statuses = (url.searchParams.get('status') ?? '').split(',').filter(Boolean);
      const items = [...vehicles.values()]
        .filter((v) => statuses.length === 0 || statuses.includes(String(v.status)))
        .map(listItem);
      const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
      return json(route, 200, {
        items: items.slice(0, pageSize),
        total: items.length,
        page: 1,
        pageSize,
      });
    }
    // Status summary: every status counted, under the list filters except status.
    if (path === '/api/vehicles/summary' && method === 'GET') {
      const counts: Record<string, number> = Object.fromEntries(
        ['IN_STOCK', 'RESERVED', 'LEASED', 'SOLD', 'RETURNED', 'SCRAPPED', 'EXTERNAL'].map((s) => [
          s,
          0,
        ]),
      );
      for (const v of vehicles.values()) counts[String(v.status)] = (counts[String(v.status)] ?? 0) + 1;
      counts.SOLD = (counts.SOLD ?? 0) + 3;
      return json(route, 200, { counts });
    }
    if (path === '/api/vehicles' && method === 'POST') {
      const created = baseVehicle({ ...(body as Json), id: 'veh_new' });
      vehicles.set('veh_new', created);
      return json(route, 201, created);
    }
    const vehicleMatch = /^\/api\/vehicles\/([^/]+)(\/.*)?$/.exec(path);
    if (vehicleMatch) {
      const vehicle = vehicles.get(vehicleMatch[1] ?? '');
      if (!vehicle) return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
      const sub = vehicleMatch[2] ?? '';
      if (sub === '' && method === 'GET') return json(route, 200, vehicle);
      if (sub === '/expenses' && method === 'GET') {
        // `{ items, total, summary }`: `total` is the sum of the amounts (not a count).
        const sum = (list: Json[]) => list.reduce((s, e) => s + Number(e.amount), 0);
        const byCategory = ['REPAIR', 'TEST']
          .map((category) => ({
            category,
            total: sum(expenses.filter((e) => e.category === category)),
          }))
          .filter((c) => c.total > 0);
        const total = sum(expenses);
        const summary = {
          cycleId: null,
          total,
          paidByUs: sum(expenses.filter((e) => e.paidBy === 'US')),
          count: expenses.length,
          byCategory,
        };
        return json(route, 200, { items: expenses, total, summary });
      }
      if (sub === '/expenses' && method === 'POST') {
        const created = {
          id: `exp_${expenses.length + 1}`,
          vehicleId: vehicle.id,
          cycleId: 'cyc_1',
          vendor: null,
          ...(body as Json),
        };
        expenses.unshift(created);
        return json(route, 201, created);
      }
      if (sub === '/pnl' && method === 'GET') {
        return json(route, 200, {
          cycles: [
            {
              id: 'cyc_1',
              kind: 'OWNED',
              startedAt: '2026-09-01',
              endedAt: null,
              open: true,
              purchasePrice: 60000,
              salePrice: null,
              listingPrice: 72000,
              commission: null,
              revenue: { sale: 72000, commission: 0, leaseIncome: 0, rebilled: 0, total: 72000 },
              costs: { purchase: 60000, expenses: 1500, vatOnMargin: 1601.69, total: 63101.69 },
              profit: 8898.31,
              unrealised: true,
            },
          ],
          totals: { revenue: 72000, costs: 63101.69, profit: 8898.31 },
        });
      }
      if (sub === '/odometer' && method === 'POST') {
        const entry = { id: 'odo_2', ...(body as Json) };
        vehicle.odometer = [entry, ...(vehicle.odometer as Json[])];
        vehicle.currentKm = (body as Json).km;
        return json(route, 201, entry);
      }
    }
    if (path === '/api/documents' && method === 'GET') {
      return json(route, 200, url.searchParams.get('vehicleId') === 'veh_1' ? documents : []);
    }
    if (/^\/api\/documents\/doc_1\/(file|thumb)$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (path === '/api/contacts')
      return json(route, 200, { items: [], total: 0, page: 1, pageSize: 20 });
    return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
  });

  return { calls, vehicles };
}

/** Page errors, console errors and React/AntD warnings (browser "Failed to load resource" lines excluded). */
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

test('vehicle file: expense, odometer, documents, new vehicle, Arabic plate', async ({ page }) => {
  // A long end-to-end flow (several pages and dialogs).
  test.setTimeout(90_000);
  const api = await mockApi(page);
  const problems = watchConsole(page);
  const lastBody = (method: string, path: string) =>
    [...api.calls].reverse().find((c) => c.method === method && c.path === path)?.body;

  // List -> row click opens the vehicle page.
  await page.goto('/vehicles');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vehicles');
  const table = page.getByTestId('vehicles-table');
  await expect(table.locator('bdi.rm-plate')).toHaveText(['123-45-678']);
  await table.getByText('Toyota Corolla').click();
  await expect(page).toHaveURL(/\/vehicles\/veh_1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vehicle');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Toyota Corolla');
  await expect(page.getByTestId('vehicle-tags')).toContainText('In stock');
  // An OWNED car with an open cycle: no consign / return actions.
  await expect(page.getByTestId('vehicle-action-consign')).toHaveCount(0);
  await expect(page.getByTestId('vehicle-action-return')).toHaveCount(0);

  // Add an expense from the header.
  await page.getByTestId('vehicle-action-expense').click();
  const expenseDialog = page.getByRole('dialog', { name: 'Add expense' });
  await expect(expenseDialog).toBeVisible();
  const category = expenseDialog.getByTestId('field-category');
  // Retried as a whole: a click during the modal's opening animation can miss the option.
  await expect(async () => {
    await category.click();
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: 'Annual test' })
      .click({ timeout: 2000 });
    await expect(category).toContainText('Annual test', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expenseDialog.getByLabel('Amount', { exact: true }).fill('450');
  await expenseDialog.getByLabel('Description').fill('Annual test and licence');
  await expenseDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Expense added')).toBeVisible();
  await expect(expenseDialog).toBeHidden();
  expect(lastBody('POST', '/api/vehicles/veh_1/expenses')).toEqual({
    category: 'TEST',
    date: TODAY,
    amount: 450,
    vatIncluded: true,
    vatReclaimable: false,
    paidBy: 'US',
    vendorId: null,
    description: 'Annual test and licence',
  });

  // The expenses tab lists it with the per-category totals.
  await page.getByRole('tab', { name: 'Expenses' }).click();
  await expect(page).toHaveURL(/tab=expenses/);
  await expect(page.getByTestId('expenses-table')).toContainText('Annual test and licence');
  await expect(page.getByTestId('expense-totals')).toContainText('₪1,650.00');
  await expect(page.locator('[data-category="TEST"]')).toContainText('₪450.00');

  // Add an odometer reading.
  await page.getByTestId('vehicle-action-odometer').click();
  const odometerDialog = page.getByRole('dialog', { name: 'Add odometer reading' });
  // The reading is an LTR isolate (LRI ... PDI) inside the translated hint.
  await expect(odometerDialog).toContainText(/Last reading: ⁦?84,500 km⁩?/);
  await odometerDialog.getByLabel('Reading (km)').fill('86000');
  await odometerDialog.getByLabel('Source').fill('Service');
  await odometerDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Reading added')).toBeVisible();
  expect(lastBody('POST', '/api/vehicles/veh_1/odometer')).toEqual({
    km: 86000,
    date: TODAY,
    source: 'Service',
  });
  await page.getByRole('tab', { name: 'Info' }).click();
  await expect(page.getByTestId('odometer-table')).toContainText('86,000');

  // Documents tab: the mocked photo is shown from its thumbnail URL.
  await page.getByRole('tab', { name: /Documents/ }).click();
  await expect(page.getByTestId('document-card')).toHaveCount(1);
  const thumb = page.getByTestId('document-card').getByRole('img', { name: 'Front view' });
  await expect(thumb).toBeVisible();
  await expect(thumb).toHaveAttribute('src', '/api/documents/doc_1/thumb');
  await expect
    .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    api.calls.some((c) => c.path === '/api/documents' && c.search.includes('vehicleId=veh_1')),
  ).toBe(true);

  // New vehicle: plate formatted while typing, taxi hint, POST with canonical digits.
  await page.getByTestId('breadcrumbs').getByRole('link', { name: 'Vehicles' }).click();
  await page.getByRole('button', { name: 'New vehicle' }).click();
  await expect(page).toHaveURL(/\/vehicles\/new$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New vehicle');
  const plate = page.getByLabel('Plate number');
  await expect(plate).toHaveAttribute('dir', 'ltr');
  await plate.pressSequentially('12345625');
  await expect(plate).toHaveValue('123-45-625');
  await expect(page.getByTestId('taxi-plate-hint')).toContainText('taxi plates');
  await page.getByTestId('taxi-plate-hint').getByRole('button', { name: 'Mark as taxi' }).click();
  await expect(page.getByTestId('taxi-meter-section')).toBeVisible();
  await page.getByLabel('Year').fill('2023');
  await page.getByLabel('Make', { exact: true }).fill('Hyundai');
  await page.keyboard.press('Escape');
  await page.getByLabel('Model', { exact: true }).fill('Ioniq');
  await page.getByLabel('Meter serial number').fill('MTR-7781');
  await page.getByLabel('Listing price').fill('95000');
  await page.getByTestId('vehicle-save').click();
  await expect(page).toHaveURL(/\/vehicles\/veh_new$/);
  await expect(page.getByText('Vehicle created')).toBeVisible();
  // The vehicle page is lazy-loaded: let it replace the form before using the top bar.
  await expect(page.getByTestId('vehicle-detail')).toBeVisible();
  expect(lastBody('POST', '/api/vehicles')).toMatchObject({
    plateNo: '12345625',
    make: 'Hyundai',
    model: 'Ioniq',
    year: 2023,
    isTaxi: true,
    status: 'IN_STOCK',
    ownership: 'OWNED',
    ownerDriverId: null,
    meterSerial: 'MTR-7781',
    listingPrice: 95000,
    vin: null,
  });

  // Arabic: right-to-left list, plate digits still in reading order (not mirrored).
  // Retried as a whole: a click during the dropdown's opening animation can miss the item.
  await expect(async () => {
    await page.getByTestId('lang-menu').click();
    await page.getByRole('menuitem', { name: 'العربية' }).click({ timeout: 2000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByTestId('breadcrumbs').getByRole('link', { name: 'المركبات' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);
  const plates = page.getByTestId('vehicles-table').locator('bdi.rm-plate');
  await expect(plates).toHaveText(['123-45-678', '123-45-625']);
  const layout = await plates.first().evaluate((el) => {
    const node = el.firstChild as Text;
    const text = node.textContent ?? '';
    const range = document.createRange();
    const rectOf = (i: number) => {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      return range.getBoundingClientRect().left;
    };
    return {
      text,
      dir: getComputedStyle(el).direction,
      tableDir: getComputedStyle(el.closest('table') as HTMLElement).direction,
      firstLeft: rectOf(0),
      lastLeft: rectOf(text.length - 1),
    };
  });
  expect(layout.text).toBe('123-45-678');
  expect(layout.tableDir).toBe('rtl');
  expect(layout.dir).toBe('ltr');
  // "1" is drawn to the left of the final "8": the plate reads left to right inside RTL.
  expect(layout.firstLeft).toBeLessThan(layout.lastLeft);
  const tableText = await page.getByTestId('vehicles-table').innerText();
  expect(tableText).not.toMatch(/[٠-٩]/);

  expect(problems).toEqual([]);
});

test('status cards filter the list; breadcrumb and side nav come back to the filter', async ({
  page,
}) => {
  const api = await mockApi(page);
  const problems = watchConsole(page);
  const summaryCalls = () => api.calls.filter((c) => c.path === '/api/vehicles/summary');

  await page.goto('/vehicles');
  const cards = page.getByTestId('status-summary');
  const inStock = cards.getByTestId('summary-card-IN_STOCK');
  await expect(inStock).toContainText('1');
  await expect(inStock).toContainText('In stock');
  await expect(cards.getByTestId('summary-card-SOLD')).toContainText('3');
  await expect(inStock).toHaveAttribute('aria-pressed', 'false');
  // No filter yet: "Clear filters" is not offered.
  await expect(page.getByTestId('filter-clear')).toHaveCount(0);

  // A card toggles the multi-select status filter in the URL.
  await inStock.click();
  await expect(page).toHaveURL(/\/vehicles\?status=IN_STOCK$/);
  await expect(inStock).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('filter-clear')).toBeVisible();
  await expect
    .poll(() =>
      api.calls.some(
        (c) =>
          c.path === '/api/vehicles' && new URLSearchParams(c.search).get('status') === 'IN_STOCK',
      ),
    )
    .toBe(true);
  // The summary itself is never filtered by status.
  expect(summaryCalls().length).toBeGreaterThan(0);
  expect(summaryCalls().every((c) => !new URLSearchParams(c.search).has('status'))).toBe(true);

  // Into the vehicle, back through the breadcrumb: the filter is restored.
  await page.getByTestId('vehicles-table').getByText('Toyota Corolla').click();
  await expect(page).toHaveURL(/\/vehicles\/veh_1$/);
  await page.getByTestId('breadcrumbs').getByRole('link', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles\?status=IN_STOCK$/);
  await expect(page.getByTestId('summary-card-IN_STOCK')).toHaveAttribute('aria-pressed', 'true');

  // The side navigation item restores it too.
  await page.getByTestId('vehicles-table').getByText('Toyota Corolla').click();
  await expect(page).toHaveURL(/\/vehicles\/veh_1$/);
  await page.getByTestId('side-nav').getByRole('menuitem', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles\?status=IN_STOCK$/);

  // "Clear filters" forgets it: the breadcrumb then leads to the plain list.
  await page.getByTestId('filter-clear').click();
  await expect(page).toHaveURL(/\/vehicles$/);
  await expect(page.getByTestId('filter-clear')).toHaveCount(0);
  await page.getByTestId('vehicles-table').getByText('Toyota Corolla').click();
  await page.getByTestId('breadcrumbs').getByRole('link', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);

  // Leaving the section forgets the filter as well.
  await page.getByTestId('summary-card-IN_STOCK').click();
  await expect(page).toHaveURL(/status=IN_STOCK/);
  await page.getByTestId('side-nav').getByRole('menuitem', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByTestId('side-nav').getByRole('menuitem', { name: 'Vehicles' }).click();
  await expect(page).toHaveURL(/\/vehicles$/);

  expect(problems).toEqual([]);
});

test('phone layout: vehicle actions collapse into a menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  const problems = watchConsole(page);
  await page.goto('/vehicles/veh_1');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Toyota Corolla');
  await expect(page.getByTestId('vehicle-action-edit')).toHaveCount(0);
  await page.getByTestId('vehicle-actions-menu').click();
  await page.getByRole('menuitem', { name: 'Add odometer reading' }).click();
  await expect(page.getByRole('dialog', { name: 'Add odometer reading' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  // The tab bar stays on one line and scrolls; tabs that do not fit are in the "more" menu.
  const tabs = page.getByRole('tab');
  const tops = await tabs.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(new Set(tops).size).toBe(1);
  await expect(async () => {
    await page.locator('.rm-detail-tabs .ant-tabs-nav-more').click();
    await page.getByRole('option', { name: 'P&L' }).click({ timeout: 2000 });
    await expect(page.getByTestId('pnl-totals')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(problems).toEqual([]);
});
