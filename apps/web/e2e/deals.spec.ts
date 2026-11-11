import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

/**
 * Deals: deals list -> new sale with a trade-in -> deal page -> record disclosure -> complete ->
 * transfer checklist -> record payment -> vehicle P&L tab -> new purchase of a new car (with a
 * duplicate-plate error first) -> Arabic: amounts keep Latin digits and `₪`. Every `/api/**`
 * call is mocked with `page.route` following the milestone-4 contract (lists
 * `{ items, total, page, pageSize }`, deal actions answer with the full deal).
 */

test.use({ timezoneId: 'Asia/Jerusalem' });

/** Today in the business time zone, as the web app computes it. */
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

/** `iso + n` working days (Friday and Saturday off), like the API's transfer rule. */
function addWorkingDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  let left = n;
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dow = date.getUTCDay();
    if (dow !== 5 && dow !== 6) left--;
  }
  return date.toISOString().slice(0, 10);
}

const HEBREW_WARRANTY =
  'אחריות ל-30 יום על מנוע וגיר. האחריות אינה כוללת בלאי, צמיגים, מצבר ונזקי תאונה.';

type Json = Record<string, unknown>;

interface Call {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

const TRANSFER_KEYS = [
  'idCopies',
  'vehicleLicenseSigned',
  'liensChecked',
  'finesChecked',
  'transferFiled',
  'newLicenseReceived',
  'insuranceHandled',
] as const;

function vehicle(over: Json): Json {
  return {
    vin: null,
    trim: null,
    color: 'לבן',
    fuel: 'PETROL',
    gearbox: 'AUTO',
    engineCc: null,
    hand: 2,
    isTaxi: false,
    status: 'IN_STOCK',
    ownership: 'OWNED',
    ownerDriverId: null,
    currentKm: 80000,
    registrationExpiry: '2027-06-01',
    dealerRegisteredAt: null,
    meterSerial: null,
    meterSealedAt: null,
    location: null,
    listingPrice: 85000,
    notes: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
    registeredLicense: null,
    ownerDriver: null,
    openCycle: null,
    alerts: [],
    ...over,
  };
}

function cycle(over: Json): Json {
  return {
    kind: 'OWNED',
    endedAt: null,
    endReason: null,
    consignorId: null,
    consignor: null,
    askingPrice: null,
    minNetToConsignor: null,
    commissionMode: null,
    commissionValue: null,
    agreementEndsAt: null,
    expenseTotal: 1500,
    ...over,
  };
}

function deal(over: Json): Json {
  return {
    cycleId: null,
    listPrice: null,
    vatMode: 'MARGIN',
    vatRate: 18,
    sellerIsVatBusiness: false,
    isTradeIn: false,
    tradeInDealId: null,
    commissionAmount: null,
    payoutAmount: null,
    warrantyText: null,
    disclosureSignedAt: null,
    transferStatus: 'NOT_STARTED',
    transferChecklist: null,
    transferDueAt: null,
    transferredAt: null,
    notes: null,
    completedAt: null,
    cancelledAt: null,
    paidIn: 0,
    paidOut: 0,
    balanceDue: 0,
    payoutDue: null,
    tradeInValue: null,
    alerts: [],
    cycle: null,
    tradeInDeal: null,
    tradeInFor: null,
    payments: [],
    vat: { mode: 'MARGIN', rate: 18, base: 0, amount: 0 },
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

  const STOCK_CYCLE = cycle({ id: 'cyc_stock', startedAt: '2026-09-01' });
  const vehicles: Json[] = [
    vehicle({
      id: 'veh_stock',
      plateNo: '12345678',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      openCycle: { id: 'cyc_stock', kind: 'OWNED', startedAt: '2026-09-01' },
    }),
    vehicle({
      id: 'veh_old',
      plateNo: '34567825',
      make: 'Skoda',
      model: 'Octavia',
      year: 2018,
      status: 'SOLD',
      listingPrice: null,
    }),
  ];
  const vehicleDetail = (v: Json): Json => ({
    ...v,
    cycles: v.id === 'veh_stock' ? [STOCK_CYCLE] : [],
    insurance: [],
    odometer: [],
    expenseSummary: { cycleId: null, total: 0, paidByUs: 0, count: 0, byCategory: [] },
    documentCount: 0,
  });

  const contacts: Json[] = [
    {
      id: 'c_buyer',
      tags: ['BUYER'],
      firstName: 'Nadia',
      lastName: 'Buyer',
      companyName: null,
      idNumber: null,
      phones: ['0521234567'],
      email: null,
      preferredLang: 'ar',
    },
    {
      id: 'c_seller',
      tags: ['SELLER'],
      firstName: 'Sami',
      lastName: 'Seller',
      companyName: null,
      idNumber: null,
      phones: ['0549876543'],
      email: null,
      preferredLang: 'he',
    },
  ];
  const nameOf = (id: unknown) => {
    const c = contacts.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : 'Unknown';
  };

  const ref = (v: Json) => ({
    id: v.id,
    plateNo: v.plateNo,
    make: v.make,
    model: v.model,
    year: v.year,
    isTaxi: v.isTaxi,
    status: v.status,
  });
  const vStock = vehicles[0] as Json;
  const vOld = vehicles[1] as Json;

  const deals = new Map<string, Json>();
  deals.set(
    'deal_s1',
    deal({
      id: 'deal_s1',
      dealNo: 40,
      type: 'SALE',
      status: 'COMPLETED',
      vehicleId: 'veh_old',
      counterpartyId: 'c_buyer',
      date: '2026-10-25',
      price: 95000,
      transferStatus: 'IN_PROGRESS',
      transferDueAt: '2026-11-02',
      transferChecklist: Object.fromEntries(TRANSFER_KEYS.map((k) => [k, k === 'idCopies'])),
      completedAt: '2026-10-25T10:00:00.000Z',
      disclosureSignedAt: '2026-10-24T10:00:00.000Z',
      vehicle: ref(vOld),
      counterparty: { id: 'c_buyer', name: 'Nadia Buyer' },
      paidIn: 95000,
      alerts: ['transferOverdue'],
    }),
  );
  deals.set(
    'deal_p1',
    deal({
      id: 'deal_p1',
      dealNo: 41,
      type: 'PURCHASE',
      status: 'COMPLETED',
      vehicleId: 'veh_stock',
      cycleId: 'cyc_stock',
      counterpartyId: 'c_seller',
      date: '2026-09-01',
      price: 60000,
      vatMode: 'NONE',
      completedAt: '2026-09-01T10:00:00.000Z',
      vehicle: ref(vStock),
      counterparty: { id: 'c_seller', name: 'Sami Seller' },
      paidOut: 60000,
      vat: { mode: 'NONE', rate: 18, base: 0, amount: 0 },
    }),
  );

  let purchaseAttempts = 0;

  const json = (route: Route, status: number, body?: unknown) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: body === undefined ? '' : JSON.stringify(body),
    });
  const list = (route: Route, items: unknown[], url: URL) => {
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25);
    return json(route, 200, {
      items: items.slice(0, pageSize),
      total: items.length,
      page: 1,
      pageSize,
    });
  };
  const listItem = (d: Json) => {
    const {
      cycle: _c,
      tradeInDeal: _t,
      tradeInFor: _f,
      payments: _p,
      vat: _v,
      documentCount: _n,
      ...item
    } = d;
    return item;
  };
  /** Recompute paid / due after a payment. */
  const settle = (d: Json) => {
    const payments = d.payments as Json[];
    const sum = (dir: string) =>
      payments.filter((p) => p.direction === dir).reduce((s, p) => s + Number(p.amount), 0);
    d.paidIn = sum('IN');
    d.paidOut = sum('OUT');
    d.balanceDue = Number(d.price) - Number(d.paidIn);
    d.alerts = (d.alerts as string[]).filter((a) => a !== 'unpaid');
    if (d.status === 'COMPLETED' && Number(d.balanceDue) > 0) (d.alerts as string[]).push('unpaid');
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
    const b = (body ?? {}) as Json;
    const q = (k: string) => url.searchParams.get(k);

    if (path === '/api/auth/me' || path === '/api/auth/refresh') {
      if (method === 'PATCH') user = { ...user, ...b };
      return json(route, 200, { user });
    }
    if (path === '/api/settings') return json(route, 200, { vatRate: 18 });

    /* ---- Contacts ---- */
    if (path === '/api/contacts' && method === 'GET') {
      const tag = q('tag');
      return list(
        route,
        contacts.filter((c) => !tag || (c.tags as string[]).includes(tag)),
        url,
      );
    }
    const contactMatch = /^\/api\/contacts\/([^/]+)$/.exec(path);
    if (contactMatch && method === 'GET') {
      const c = contacts.find((x) => x.id === contactMatch[1]);
      if (!c) return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
      return json(route, 200, { ...c, driver: null, counts: { deals: 1, documents: 0 } });
    }

    /* ---- Vehicles ---- */
    if (path === '/api/vehicles' && method === 'GET') {
      const status = q('status');
      const items = vehicles.filter(
        (v) =>
          (!status || status.split(',').includes(String(v.status))) &&
          (!q('ownership') || v.ownership === q('ownership')),
      );
      return list(route, items, url);
    }
    const vehicleMatch = /^\/api\/vehicles\/([^/]+)(\/[a-z]+)?$/.exec(path);
    if (vehicleMatch && method === 'GET') {
      const v = vehicles.find((x) => x.id === vehicleMatch[1]);
      if (!v) return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
      if (vehicleMatch[2] === '/pnl') {
        return json(route, 200, {
          cycles: [
            {
              id: 'cyc_stock',
              kind: 'OWNED',
              startedAt: '2026-09-01',
              endedAt: TODAY,
              open: false,
              purchasePrice: 60000,
              salePrice: 80000,
              listingPrice: 85000,
              commission: null,
              revenue: { sale: 80000, commission: 0, leaseIncome: 0, rebilled: 0, total: 80000 },
              costs: { purchase: 60000, expenses: 1500, vatOnMargin: 3050.85, total: 64550.85 },
              profit: 15449.15,
              unrealised: false,
            },
          ],
          totals: { revenue: 80000, costs: 64550.85, profit: 15449.15 },
        });
      }
      if (!vehicleMatch[2]) return json(route, 200, vehicleDetail(v));
    }

    /* ---- Deals ---- */
    if (path === '/api/deals' && method === 'GET') {
      const items = [...deals.values()]
        .filter((d) => !q('vehicleId') || d.vehicleId === q('vehicleId'))
        .filter((d) => !q('counterpartyId') || d.counterpartyId === q('counterpartyId'))
        .filter((d) => !q('type') || q('type')?.split(',').includes(String(d.type)))
        .filter((d) => !q('status') || q('status')?.split(',').includes(String(d.status)))
        .sort((a, b) => Number(b.dealNo) - Number(a.dealNo))
        .map(listItem);
      return list(route, items, url);
    }
    if (path === '/api/deals' && method === 'POST') {
      if (b.type === 'PURCHASE') {
        purchaseAttempts += 1;
        // The first plate typed is already in the system.
        if (purchaseAttempts === 1) {
          return json(route, 409, {
            statusCode: 409,
            message: 'errors.conflict',
            errors: [{ path: 'vehicle.create.plateNo', message: 'validation.duplicate' }],
          });
        }
        const create = ((b.vehicle as Json).create ?? {}) as Json;
        const created = vehicle({ ...create, id: 'veh_new', status: 'IN_STOCK' });
        vehicles.push(created);
        const d = deal({
          id: 'deal_buy',
          dealNo: 44,
          type: 'PURCHASE',
          status: 'DRAFT',
          vehicleId: 'veh_new',
          counterpartyId: b.counterpartyId,
          date: b.date,
          price: b.price,
          listPrice: b.listPrice,
          sellerIsVatBusiness: b.sellerIsVatBusiness,
          vatMode: b.sellerIsVatBusiness ? 'FULL' : 'NONE',
          notes: b.notes,
          vehicle: ref(created),
          counterparty: { id: b.counterpartyId, name: nameOf(b.counterpartyId) },
          balanceDue: b.price,
        });
        deals.set('deal_buy', d);
        return json(route, 201, d);
      }
      const v = vehicles.find((x) => x.id === b.vehicleId) as Json;
      v.status = 'RESERVED';
      const tradeIn = b.tradeIn as Json | undefined;
      const tiCreate = ((tradeIn?.vehicle as Json | undefined)?.create ?? {}) as Json;
      const d = deal({
        id: 'deal_new',
        dealNo: 42,
        type: 'SALE',
        status: 'DRAFT',
        vehicleId: v.id,
        cycleId: 'cyc_stock',
        counterpartyId: b.counterpartyId,
        date: b.date,
        price: b.price,
        listPrice: b.listPrice,
        vatMode: b.vatMode,
        warrantyText: b.warrantyText,
        notes: b.notes,
        tradeInDealId: tradeIn ? 'deal_ti' : null,
        vehicle: ref(v),
        counterparty: { id: b.counterpartyId, name: nameOf(b.counterpartyId) },
        tradeInValue: tradeIn?.value ?? null,
        alerts: ['disclosureMissing'],
        cycle: { ...STOCK_CYCLE, purchasePrice: 60000 },
        tradeInDeal: tradeIn
          ? {
              id: 'deal_ti',
              dealNo: 43,
              vehicle: {
                id: 'veh_ti',
                plateNo: tiCreate.plateNo,
                make: tiCreate.make,
                model: tiCreate.model,
              },
              price: tradeIn.value,
              status: 'PENDING',
            }
          : null,
        payments: tradeIn
          ? [
              {
                id: 'pay_ti',
                direction: 'IN',
                date: b.date,
                amount: tradeIn.value,
                method: 'TRADE_IN',
                reference: null,
                notes: null,
                contact: { id: b.counterpartyId, name: nameOf(b.counterpartyId) },
              },
            ]
          : [],
        vat: { mode: 'MARGIN', rate: 18, base: 20000, amount: 3050.85 },
      });
      settle(d);
      deals.set('deal_new', d);
      return json(route, 201, d);
    }
    const dealMatch = /^\/api\/deals\/([^/]+)(\/[a-z]+)?$/.exec(path);
    if (dealMatch) {
      const d = deals.get(dealMatch[1] ?? '');
      if (!d) return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
      const sub = dealMatch[2] ?? '';
      if (sub === '' && method === 'GET') return json(route, 200, d);
      if (sub === '/disclosure' && method === 'POST') {
        d.disclosureSignedAt = b.signedAt;
        d.alerts = (d.alerts as string[]).filter((a) => a !== 'disclosureMissing');
        return json(route, 200, d);
      }
      if (sub === '/complete' && method === 'POST') {
        const date = String(b.date ?? d.date);
        Object.assign(d, {
          status: 'COMPLETED',
          completedAt: `${date}T10:00:00.000Z`,
          transferDueAt: addWorkingDays(date, 6),
          transferChecklist: Object.fromEntries(TRANSFER_KEYS.map((k) => [k, false])),
        });
        if (d.tradeInDeal) (d.tradeInDeal as Json).status = 'COMPLETED';
        (vStock as Json).status = 'SOLD';
        (d.vehicle as Json).status = 'SOLD';
        settle(d);
        return json(route, 200, d);
      }
      if (sub === '/transfer' && method === 'PATCH') {
        const checklist = { ...(d.transferChecklist as Json), ...((b.checklist ?? {}) as Json) };
        const done = TRANSFER_KEYS.filter((k) => checklist[k] === true).length;
        Object.assign(d, {
          transferChecklist: checklist,
          transferStatus:
            b.transferStatus ?? (done === 0 ? 'NOT_STARTED' : done === 7 ? 'DONE' : 'IN_PROGRESS'),
          transferredAt: b.transferredAt ?? d.transferredAt,
        });
        return json(route, 200, d);
      }
      if (sub === '/payments' && method === 'POST') {
        (d.payments as Json[]).push({
          id: `pay_${(d.payments as Json[]).length + 1}`,
          ...b,
          contact: { id: d.counterpartyId, name: nameOf(d.counterpartyId) },
        });
        settle(d);
        return json(route, 201, d);
      }
    }
    if (path === '/api/documents') return json(route, 200, []);
    return json(route, 404, { statusCode: 404, message: 'errors.notFound' });
  });

  return { calls };
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

/** Pick an option of an open AntD select dropdown; retried, since clicks during animations can miss. */
async function chooseOption(page: Page, trigger: Locator, option: string | RegExp, type?: string) {
  await expect(async () => {
    await trigger.click();
    if (type) await trigger.locator('input').fill(type);
    await page
      .locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option })
      .first()
      .click({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

test('sale with trade-in, disclosure, completion, transfer, payment, P&L, purchase, Arabic', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const api = await mockApi(page);
  const problems = watchConsole(page);
  const lastBody = (method: string, path: string) =>
    [...api.calls].reverse().find((c) => c.method === method && c.path === path)?.body;

  /* ---- Deals list ---- */
  await page.goto('/deals');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deals');
  const table = page.getByTestId('deals-table');
  await expect(table).toContainText('#40');
  await expect(table).toContainText('#41');
  await expect(table.locator('[data-deal-type="SALE"]')).toHaveText('Sale');
  await expect(table.locator('[data-deal-type="PURCHASE"]')).toHaveText('Purchase');
  await expect(table.locator('bdi.rm-plate')).toHaveText(['123-45-678', '345-67-825']);
  await expect(table.locator('[data-alert="transferOverdue"]')).toHaveText('Transfer overdue');
  await expect(table.locator('[data-transfer-due="overdue"]')).toContainText('Overdue');
  await expect(table).toContainText('₪95,000.00');

  /* ---- New sale with a trade-in ---- */
  await page.getByTestId('deal-new').click();
  await expect(page).toHaveURL(/\/deals\/new\?type=SALE$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New deal');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('New sale');
  await chooseOption(page, page.getByTestId('sale-vehicle-picker'), 'Toyota Corolla');
  const info = page.getByTestId('sale-vehicle-info');
  await expect(info).toContainText('₪60,000.00');
  await expect(info).toContainText('₪85,000.00');
  await chooseOption(page, page.getByTestId('contact-picker'), 'Nadia Buyer');
  await page.getByLabel('Price', { exact: true }).fill('80000');
  await page.getByLabel('List price (Levi Yitzhak)').fill('82000');
  await expect(page.getByTestId('list-gap')).toContainText('below list');
  // VAT on the margin over the 60,000 purchase: 20,000 x 18 / 118.
  await expect(page.getByTestId('vat-amount')).toHaveText('₪3,050.85');
  // The warranty defaults to the Hebrew text.
  await expect(page.getByLabel('Warranty')).toHaveValue(HEBREW_WARRANTY);

  await page.getByTestId('trade-in-switch').click();
  const block = page.getByTestId('trade-in-block');
  await expect(block).toBeVisible();
  await block.getByLabel('Plate number').fill('1234567');
  await expect(block.getByLabel('Plate number')).toHaveValue('12-345-67');
  await block.getByLabel('Make', { exact: true }).fill('Mazda');
  await block.getByLabel('Model', { exact: true }).fill('3');
  await block.getByLabel('Year').fill('2017');
  await page.getByLabel('Trade-in value').fill('20000');
  await page.getByLabel('List price of the trade-in').fill('22000');
  await expect(page.getByTestId('cash-due-amount')).toHaveText('₪60,000.00');
  await page.getByTestId('deal-save').click();

  await expect(page).toHaveURL(/\/deals\/deal_new$/);
  expect(lastBody('POST', '/api/deals')).toEqual({
    type: 'SALE',
    vehicleId: 'veh_stock',
    counterpartyId: 'c_buyer',
    date: TODAY,
    price: 80000,
    listPrice: 82000,
    notes: null,
    vatMode: 'MARGIN',
    warrantyText: HEBREW_WARRANTY,
    tradeIn: {
      vehicle: {
        create: {
          plateNo: '1234567',
          vin: null,
          make: 'Mazda',
          model: '3',
          trim: null,
          year: 2017,
          color: null,
          fuel: null,
          gearbox: null,
          hand: null,
          isTaxi: false,
          currentKm: null,
          registrationExpiry: null,
        },
      },
      value: 20000,
      listPrice: 22000,
    },
  });

  /* ---- Deal page ---- */
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deal');
  await expect(page.getByRole('heading', { level: 2 })).toContainText('#42');
  const tags = page.getByTestId('deal-tags');
  const facts = page.getByTestId('deal-facts');
  await expect(tags).toContainText('Draft');
  await expect(facts).toContainText('Nadia Buyer');
  await expect(facts.locator('bdi.rm-plate')).toHaveText('123-45-678');
  await expect(tags.locator('[data-alert="disclosureMissing"]')).toHaveText(
    'Disclosure not signed',
  );
  await expect(page.getByTestId('deal-trade-in-card')).toContainText('#43');
  await expect(page.getByTestId('deal-cash-due')).toHaveText('₪60,000.00');
  await expect(page.getByTestId('deal-vat-amount')).toHaveText('₪3,050.85');

  /* ---- Record disclosure ---- */
  await page.getByTestId('deal-action-disclosure').click();
  const disclosure = page.getByRole('dialog', { name: 'Disclosure form' });
  await expect(disclosure).toBeVisible();
  await expect(disclosure.getByTestId('disclosure-upload-hint')).toContainText('Disclosure form');
  await disclosure.getByRole('button', { name: 'Record' }).click();
  await expect(page.getByText('Disclosure recorded')).toBeVisible();
  expect(lastBody('POST', '/api/deals/deal_new/disclosure')).toEqual({
    signedAt: expect.stringMatching(new RegExp(`^${TODAY}T\\d{2}:00:00\\.000Z$`)),
  });
  await expect(tags.locator('[data-alert="disclosureMissing"]')).toHaveCount(0);

  /* ---- Complete ---- */
  await page.getByTestId('deal-action-complete').click();
  const complete = page.getByRole('dialog', { name: 'Complete deal' });
  await expect(complete).toBeVisible();
  await expect(complete.getByTestId('complete-blockers')).toHaveCount(0);
  await expect(complete.getByTestId('complete-transfer-due')).toBeVisible();
  await complete.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByText('Deal completed')).toBeVisible();
  expect(lastBody('POST', '/api/deals/deal_new/complete')).toEqual({ date: TODAY });
  await expect(tags).toContainText('Completed');
  await expect(facts.getByTestId('transfer-cell')).toContainText('Not started');

  /* ---- Transfer checklist ---- */
  await page.getByRole('tab', { name: 'Transfer' }).click();
  const checklist = page.getByTestId('transfer-checklist');
  await expect(checklist).toHaveAttribute('data-total', '7');
  await expect(checklist).toHaveAttribute('data-done', '0');
  // Each tick is saved at once (PATCH), so click and wait for the saved state.
  const idCopies = checklist.getByRole('checkbox', { name: 'ID copies collected' });
  await idCopies.click();
  await expect(idCopies).toBeChecked();
  await expect(checklist).toHaveAttribute('data-done', '1');
  expect(lastBody('PATCH', '/api/deals/deal_new/transfer')).toEqual({
    checklist: { idCopies: true },
  });
  await expect(checklist).toContainText('In progress');

  /* ---- Record payment ---- */
  await page.getByTestId('deal-action-payment').click();
  const payment = page.getByRole('dialog', { name: 'Record payment' });
  await expect(payment).toBeVisible();
  // Prefilled with the cash still due after the trade-in.
  await expect(payment.getByLabel('Amount', { exact: true })).toHaveValue('60000.00');
  await payment.getByLabel('Reference').fill('TRX-881');
  await payment.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Payment recorded')).toBeVisible();
  expect(lastBody('POST', '/api/deals/deal_new/payments')).toEqual({
    direction: 'IN',
    date: TODAY,
    amount: 60000,
    method: 'CASH',
    reference: 'TRX-881',
    notes: null,
  });
  await page.getByRole('tab', { name: /Payments/ }).click();
  const payments = page.getByTestId('deal-payments-table');
  await expect(payments).toContainText('TRX-881');
  await expect(payments.getByTestId('payment-system')).toHaveCount(1);
  await expect(page.getByTestId('summary-paid-in')).toContainText('₪80,000.00');
  await expect(page.getByTestId('summary-balance-due')).toContainText('₪0.00');

  /* ---- Vehicle P&L tab ---- */
  await page.goto('/vehicles/veh_stock?tab=pnl');
  const totals = page.getByTestId('pnl-totals');
  await expect(totals).toContainText('₪80,000.00');
  await expect(totals).toContainText('₪64,550.85');
  await expect(totals.getByTestId('pnl-total-profit')).toHaveText('₪15,449.15');
  await expect(totals.getByTestId('pnl-total-profit')).toHaveAttribute('data-profit', 'profit');
  await page.getByRole('tab', { name: 'Deals' }).click();
  await expect(page.getByTestId('vehicle-deals-table')).toContainText('#42');

  /* ---- New purchase of a new car ---- */
  await page.goto('/deals');
  await page.getByTestId('deal-new-menu').click();
  await page.getByRole('menuitem', { name: 'New purchase' }).click();
  await expect(page).toHaveURL(/\/deals\/new\?type=PURCHASE$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('New purchase');
  const car = page.getByTestId('vehicle-inline');
  await car.getByLabel('Plate number').fill('12345678');
  await car.getByLabel('Make', { exact: true }).fill('Kia');
  await car.getByLabel('Model', { exact: true }).fill('Picanto');
  await car.getByLabel('Year').fill('2019');
  await car.getByLabel('Odometer').fill('90000');
  await chooseOption(page, page.getByTestId('contact-picker'), 'Sami Seller');
  await page.getByLabel('Price', { exact: true }).fill('35000');
  await page.getByRole('checkbox', { name: 'The seller is a VAT-registered business' }).check();
  await page.getByLabel('Notes').fill('Bought at auction');
  await page.getByTestId('deal-save').click();
  // The plate is already known: the API error lands on the inline plate field.
  await expect(car).toContainText('A record with this value already exists');
  await car.getByLabel('Plate number').fill('23456789');
  await page.getByTestId('deal-save').click();
  await expect(page).toHaveURL(/\/deals\/deal_buy$/);
  expect(lastBody('POST', '/api/deals')).toEqual({
    type: 'PURCHASE',
    vehicle: {
      create: {
        plateNo: '23456789',
        vin: null,
        make: 'Kia',
        model: 'Picanto',
        trim: null,
        year: 2019,
        color: null,
        fuel: null,
        gearbox: null,
        hand: null,
        isTaxi: false,
        currentKm: 90000,
        registrationExpiry: null,
      },
    },
    counterpartyId: 'c_seller',
    date: TODAY,
    price: 35000,
    listPrice: null,
    notes: 'Bought at auction',
    sellerIsVatBusiness: true,
  });
  await expect(page.getByTestId('deal-facts')).toContainText('Sami Seller');
  await expect(page.getByTestId('deal-action-disclosure')).toHaveCount(0);

  /* ---- Arabic: amounts keep Latin digits and the shekel sign ---- */
  await page.goto('/deals/deal_new');
  await page.getByTestId('lang-menu').click();
  await page.getByRole('menuitem', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const price = await page.getByTestId('deal-price').innerText();
  expect(price).toContain('₪');
  expect(price).toContain('80,000.00');
  expect(price).not.toMatch(/[٠-٩]/);
  const summary = await page.getByTestId('deal-summary').innerText();
  expect(summary).toContain('60,000.00');
  expect(summary).not.toMatch(/[٠-٩]/);
  await page.goto('/deals');
  await expect(page.getByTestId('deals-table')).toContainText('₪');
  const tableText = await page.getByTestId('deals-table').innerText();
  expect(tableText).toContain('95,000.00');
  expect(tableText).not.toMatch(/[٠-٩]/);

  expect(problems).toEqual([]);
});
