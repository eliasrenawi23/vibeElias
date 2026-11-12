import { installValidationErrorMap, todayInBusinessTz } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import type { TaxiLicenseDetail } from '../types';
import { FeePaidDialog, FeePaidFormSchema } from './FeePaidDialog';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function license(over: Partial<TaxiLicenseDetail> = {}): TaxiLicenseDetail {
  return {
    id: 'tl_1',
    licenseNo: '24718',
    holderName: null,
    status: 'ACTIVE',
    acquiredAt: null,
    acquisitionPrice: null,
    soldAt: null,
    salePrice: null,
    annualFeeDueAt: '2026-12-31',
    renewalAt: null,
    notes: null,
    registeredVehicle: { id: 'veh_1', plateNo: '8473126' },
    currentSegment: null,
    alerts: ['annualFeeDue'],
    segments: [],
    documentCount: 0,
    ...over,
  };
}

describe('FeePaidFormSchema', () => {
  it('needs a payment date; the amount is optional but positive', () => {
    expect(FeePaidFormSchema.safeParse({}).success).toBe(false);
    expect(FeePaidFormSchema.parse({ paidAt: '2026-11-12', amount: null, note: '' })).toEqual({
      paidAt: '2026-11-12',
      amount: null,
      note: null,
    });
    const zero = FeePaidFormSchema.safeParse({ paidAt: '2026-11-12', amount: 0 });
    expect(zero.success).toBe(false);
    expect(zero.error?.issues[0]?.path).toEqual(['amount']);
  });
});

describe('FeePaidDialog', () => {
  it('shows the next due date and posts the date, amount and note', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(license({ annualFeeDueAt: '2027-12-31' })));
    const onSaved = vi.fn();
    renderWithProviders(<FeePaidDialog license={license()} onClose={vi.fn()} onSaved={onSaved} />);

    // Due 31.12.2026 -> next 31.12.2027.
    expect(await screen.findByTestId('fee-paid-next')).toHaveAttribute('data-date', '2027-12-31');
    expect(screen.getByText(/Recorded as a licence-fee expense on/)).toHaveTextContent(
      '84-731-26',
    );
    expect(screen.queryByTestId('fee-paid-no-vehicle')).toBeNull();

    fireEvent.change(screen.getByLabelText('Amount paid'), { target: { value: '1450' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: ' December slip ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as paid' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[1]).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/taxi-licenses/tl_1/fee-paid');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      paidAt: todayInBusinessTz(),
      amount: 1450,
      note: 'December slip',
    });
  });

  it('without a registered car only the date moves (no amount field, amount null)', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(license()));
    const onSaved = vi.fn();
    renderWithProviders(
      <FeePaidDialog
        license={license({ registeredVehicle: null, annualFeeDueAt: null })}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByTestId('fee-paid-no-vehicle')).toBeInTheDocument();
    expect(screen.queryByLabelText('Amount paid')).toBeNull();
    // No due date yet: the year after the payment.
    const nextYear = Number(todayInBusinessTz().slice(0, 4)) + 1;
    expect(screen.getByTestId('fee-paid-next')).toHaveAttribute('data-date', `${nextYear}-12-31`);

    fireEvent.click(screen.getByRole('button', { name: 'Mark as paid' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[1]).toBe(false);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ paidAt: todayInBusinessTz(), amount: null, note: null });
  });

  it('shows a sold licence error from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ statusCode: 409, message: 'errors.licenseNotActive' }, 409),
    );
    const onSaved = vi.fn();
    renderWithProviders(<FeePaidDialog license={license()} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as paid' }));
    expect(await screen.findByText('The taxi licence is not active')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
