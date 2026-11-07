import { installValidationErrorMap, stripBidiMarks } from '@renawi/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { DealForm } from './DealForm';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function vehicle(over: Record<string, unknown>) {
  return {
    id: 'veh_1',
    plateNo: '12345678',
    vin: null,
    make: 'Toyota',
    model: 'Corolla',
    trim: null,
    year: 2020,
    color: null,
    fuel: null,
    gearbox: null,
    engineCc: null,
    hand: 1,
    isTaxi: false,
    status: 'IN_STOCK',
    ownership: 'OWNED',
    ownerDriverId: null,
    currentKm: 80000,
    registrationExpiry: null,
    dealerRegisteredAt: null,
    meterSerial: null,
    meterSealedAt: null,
    location: null,
    listingPrice: 85000,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    registeredLicense: null,
    ownerDriver: null,
    openCycle: { id: 'cyc_1', kind: 'OWNED', startedAt: '2026-09-01' },
    alerts: [],
    insurance: [],
    odometer: [],
    expenseSummary: { total: 0, byCategory: [] },
    documentCount: 0,
    cycles: [
      {
        id: 'cyc_1',
        kind: 'OWNED',
        startedAt: '2026-09-01',
        endedAt: null,
        endReason: null,
        consignorId: null,
        consignor: null,
        askingPrice: null,
        minNetToConsignor: null,
        commissionMode: null,
        commissionValue: null,
        agreementEndsAt: null,
        expenseTotal: 0,
      },
    ],
    ...over,
  };
}

const CONSIGNED_CYCLE = {
  id: 'cyc_9',
  kind: 'CONSIGNED',
  startedAt: '2026-10-01',
  endedAt: null,
  endReason: null,
  consignorId: 'c_owner',
  consignor: { id: 'c_owner', name: 'Yousef Owner' },
  askingPrice: 80000,
  minNetToConsignor: 70000,
  commissionMode: 'PERCENT',
  commissionValue: 5,
  agreementEndsAt: null,
  expenseTotal: 0,
};

interface MockOptions {
  car: ReturnType<typeof vehicle>;
  /** Completed purchase of the open cycle (sale forms). */
  purchase?: { price: number; sellerIsVatBusiness: boolean } | null;
}

function mockApi({ car, purchase = null }: MockOptions) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const page = (items: unknown[]) =>
      jsonResponse({ items, total: items.length, page: 1, pageSize: 50 });
    if (url.pathname === '/api/vehicles') return page([car]);
    if (url.pathname === `/api/vehicles/${car.id}`) return jsonResponse(car);
    if (url.pathname === '/api/deals') {
      return page(
        purchase
          ? [
              {
                id: 'deal_p',
                dealNo: 7,
                type: 'PURCHASE',
                status: 'COMPLETED',
                cycleId: 'cyc_1',
                price: purchase.price,
                sellerIsVatBusiness: purchase.sellerIsVatBusiness,
              },
            ]
          : [],
      );
    }
    if (url.pathname === '/api/settings') return jsonResponse({ vatRate: 18 });
    if (url.pathname === '/api/contacts') return page([]);
    return jsonResponse({ statusCode: 404, message: 'errors.notFound' }, 404);
  });
}

function renderForm(type: 'SALE' | 'CONSIGNMENT_SALE' | 'PURCHASE', vehicleId = 'veh_1') {
  return renderWithProviders(
    <MemoryRouter>
      <DealForm type={type} initialVehicleId={vehicleId} onCreated={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

const typeAmount = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('DealForm: sale', () => {
  it('shows the trade-in block only when switched on and computes the cash due', async () => {
    mockApi({ car: vehicle({}), purchase: { price: 60000, sellerIsVatBusiness: false } });
    renderForm('SALE');
    typeAmount('Price', '80000');

    expect(screen.queryByTestId('trade-in-block')).toBeNull();
    expect(screen.getByTestId('deal-section-trade-in')).toHaveTextContent('No trade-in.');
    fireEvent.click(screen.getByTestId('trade-in-switch'));

    const block = await screen.findByTestId('trade-in-block');
    // A new car typed inline by default.
    expect(within(block).getByLabelText('Plate number')).toBeInTheDocument();
    typeAmount('Trade-in value', '20000');
    await waitFor(() =>
      expect(screen.getByTestId('cash-due-amount')).toHaveTextContent('₪60,000.00'),
    );
    typeAmount('Price', '95000.50');
    await waitFor(() =>
      expect(screen.getByTestId('cash-due-amount')).toHaveTextContent('₪75,000.50'),
    );

    // Switched off again: the block and the cash-due line go away.
    fireEvent.click(screen.getByTestId('trade-in-switch'));
    await waitFor(() => expect(screen.queryByTestId('trade-in-block')).toBeNull());
    expect(screen.queryByTestId('cash-due')).toBeNull();
  });

  it('shows the VAT on the margin over the purchase price', async () => {
    mockApi({ car: vehicle({}), purchase: { price: 60000, sellerIsVatBusiness: false } });
    renderForm('SALE');
    // Car info: purchase price of the open cycle and the listing price.
    const info = await screen.findByTestId('sale-vehicle-info');
    await waitFor(() => expect(info).toHaveTextContent('₪60,000.00'));
    expect(info).toHaveTextContent('₪85,000.00');

    expect(screen.getByTestId('vat-preview')).toHaveTextContent('Enter the price to see the VAT.');
    typeAmount('Price', '80000');
    // (80,000 - 60,000) x 18 / 118 = 3,050.85
    await waitFor(() => expect(screen.getByTestId('vat-amount')).toHaveTextContent('₪3,050.85'));
    expect(screen.getByTestId('vat-preview')).toHaveAttribute('data-vat-mode', 'MARGIN');
    expect(screen.getByTestId('vat-preview')).toHaveTextContent('₪20,000.00');
    expect(screen.queryByTestId('vat-forced-full')).toBeNull();

    // A loss owes no VAT on the margin.
    typeAmount('Price', '55000');
    await waitFor(() => expect(screen.getByTestId('vat-amount')).toHaveTextContent('₪0.00'));
  });

  it('forces full VAT when the car was bought from a VAT-registered business', async () => {
    mockApi({ car: vehicle({}), purchase: { price: 60000, sellerIsVatBusiness: true } });
    renderForm('SALE');
    expect(
      await screen.findByText(
        'This car was bought from a VAT-registered business, so the sale carries full VAT.',
      ),
    ).toBeInTheDocument();
    typeAmount('Price', '80000');
    // Full VAT contained in the price: 80,000 x 18 / 118 = 12,203.39
    await waitFor(() => expect(screen.getByTestId('vat-amount')).toHaveTextContent('₪12,203.39'));
    expect(screen.getByTestId('vat-preview')).toHaveAttribute('data-vat-mode', 'FULL');
    expect(screen.getByRole('radio', { name: 'VAT on margin' })).toBeDisabled();
  });
});

describe('DealForm: consignment sale', () => {
  const car = () =>
    vehicle({
      id: 'veh_9',
      ownership: 'CONSIGNED',
      openCycle: { id: 'cyc_9', kind: 'CONSIGNED', startedAt: '2026-10-01' },
      cycles: [CONSIGNED_CYCLE],
    });

  it('shows the consignment terms and computes the commission and payout', async () => {
    mockApi({ car: car() });
    renderForm('CONSIGNMENT_SALE', 'veh_9');
    const info = await screen.findByTestId('consignment-info');
    expect(info).toHaveTextContent('Yousef Owner');
    expect(info).toHaveTextContent('₪80,000.00');
    expect(info).toHaveTextContent('₪70,000.00');
    // The amounts inside the sentence are bidi-isolated.
    expect(stripBidiMarks(within(info).getByTestId('commission-rule').textContent ?? '')).toBe(
      '5% of the price',
    );

    typeAmount('Price', '80000');
    // 5% of 80,000 = 4,000; the consignor gets 76,000.
    await waitFor(() =>
      expect(screen.getByTestId('commission-amount')).toHaveTextContent('₪4,000.00'),
    );
    expect(screen.getByTestId('payout-amount')).toHaveTextContent('₪76,000.00');
    expect(screen.queryByTestId('below-min-net')).toBeNull();

    // 72,000: payout 68,400 is under the agreed minimum net of 70,000.
    typeAmount('Price', '72000');
    await waitFor(() =>
      expect(screen.getByTestId('payout-amount')).toHaveTextContent('₪68,400.00'),
    );
    expect(screen.getByTestId('commission-amount')).toHaveTextContent('₪3,600.00');
    expect(screen.getByTestId('below-min-net')).toBeInTheDocument();
  });

  it('applies the surplus rule (everything above the minimum net)', async () => {
    mockApi({
      car: vehicle({
        id: 'veh_9',
        ownership: 'CONSIGNED',
        openCycle: { id: 'cyc_9', kind: 'CONSIGNED', startedAt: '2026-10-01' },
        cycles: [{ ...CONSIGNED_CYCLE, commissionMode: 'SURPLUS', commissionValue: null }],
      }),
    });
    renderForm('CONSIGNMENT_SALE', 'veh_9');
    const info = await screen.findByTestId('consignment-info');
    expect(stripBidiMarks(within(info).getByTestId('commission-rule').textContent ?? '')).toBe(
      'Everything above ₪70,000.00',
    );
    typeAmount('Price', '78500');
    await waitFor(() =>
      expect(screen.getByTestId('commission-amount')).toHaveTextContent('₪8,500.00'),
    );
    expect(screen.getByTestId('payout-amount')).toHaveTextContent('₪70,000.00');
  });
});
