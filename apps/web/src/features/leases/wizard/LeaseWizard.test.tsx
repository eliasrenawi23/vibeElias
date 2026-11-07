import { installValidationErrorMap } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { LeaseWizard } from './LeaseWizard';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

const DRIVER = {
  id: 'drv_1',
  contactId: 'c_1',
  licenseNo: null,
  licenseExpiry: null,
  taxiPermitNo: null,
  taxiPermitExpiry: '2027-05-01',
  medicalExpiry: null,
  emergencyName: null,
  emergencyPhone: null,
  startedAt: null,
  status: 'ACTIVE',
  notes: null,
  contact: {
    id: 'c_1',
    firstName: 'Samir',
    lastName: 'Haddad',
    companyName: null,
    phones: ['0501234567'],
    idNumber: null,
    email: null,
    preferredLang: 'ar',
  },
  name: 'Samir Haddad',
  activeContract: null,
  balance: { charged: 0, paid: 0, credited: 0, balance: 0, depositHeld: 0 },
  alerts: [],
};

const LICENSE = {
  id: 'tl_1',
  licenseNo: 'T-1001',
  holderName: null,
  status: 'ACTIVE',
  acquiredAt: null,
  acquisitionPrice: null,
  soldAt: null,
  salePrice: null,
  annualFeeDueAt: '2026-12-31',
  renewalAt: null,
  notes: null,
  registeredVehicle: null,
  currentSegment: null,
  alerts: ['idle'],
};

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const page = (items: unknown[]) =>
      jsonResponse({ items, total: items.length, page: 1, pageSize: 20 });
    if (url.pathname === '/api/drivers') return page([DRIVER]);
    if (url.pathname === '/api/drivers/drv_1') return jsonResponse({ ...DRIVER, contracts: [] });
    if (url.pathname === '/api/taxi-licenses') return page([LICENSE]);
    if (url.pathname === '/api/taxi-licenses/tl_1')
      return jsonResponse({ ...LICENSE, segments: [], documentCount: 0 });
    if (url.pathname === '/api/vehicles') return page([]);
    return jsonResponse({ statusCode: 404, message: 'errors.notFound' }, 404);
  });
}

function renderWizard() {
  renderWithProviders(
    <MemoryRouter>
      <LeaseWizard initialDriverId="drv_1" onCreated={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
  );
}

const currentStep = () => document.querySelector('[data-step]')?.getAttribute('data-step');
const next = () => fireEvent.click(screen.getByTestId('wizard-next'));

describe('LeaseWizard', () => {
  it('cannot continue without a licence, and needs a car for a car + licence lease', async () => {
    mockApi();
    renderWizard();
    expect(currentStep()).toBe('driver');

    // The preselected driver is valid: on to the licence.
    next();
    await waitFor(() => expect(currentStep()).toBe('license'));
    await screen.findByRole('radio', { name: /T-1001/ });

    // No licence chosen: the step stays and says why.
    next();
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(currentStep()).toBe('license');

    fireEvent.click(screen.getByRole('radio', { name: /T-1001/ }));
    await waitFor(() => expect(screen.queryByText('This field is required')).toBeNull());
    next();
    await waitFor(() => expect(currentStep()).toBe('vehicle'));

    // Car + licence (the default) without a car: blocked.
    next();
    expect(
      await screen.findByText('Choose the taxi for a car + licence lease'),
    ).toBeInTheDocument();
    expect(currentStep()).toBe('vehicle');

    // A licence-only lease does not need a car.
    fireEvent.click(screen.getByRole('radio', { name: 'Licence only' }));
    next();
    await waitFor(() => expect(currentStep()).toBe('terms'));
  });

  it('needs a driver on the first step', async () => {
    mockApi();
    renderWithProviders(
      <MemoryRouter>
        <LeaseWizard onCreated={vi.fn()} onCancel={vi.fn()} />
      </MemoryRouter>,
    );
    next();
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
    expect(currentStep()).toBe('driver');
  });
});
