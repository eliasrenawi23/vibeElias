import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import type { VehicleDetail } from '../types';
import { ConvertToPrivateDialog } from './ConvertToPrivateDialog';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function taxi(over: Partial<VehicleDetail> = {}): VehicleDetail {
  return {
    id: 'veh_1',
    plateNo: '8473126',
    isTaxi: true,
    listingPrice: 35000,
    expectedConversionTax: 15000,
    privatePriceEstimate: 50000,
    canConvert: { allowed: true, blockers: [] },
    plateHistory: [],
    registeredLicense: null,
    ...over,
  } as VehicleDetail;
}

function renderDialog(vehicle: VehicleDetail, onSaved = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <ConvertToPrivateDialog vehicle={vehicle} onClose={vi.fn()} onSaved={onSaved} />
    </MemoryRouter>,
  );
  return { onSaved };
}

const plain = (el: HTMLElement) => (el.textContent ?? '').replace(/[⁦-⁩]/g, '');

const input = (label: string) => screen.getByLabelText(new RegExp(label)) as HTMLInputElement;

describe('ConvertToPrivateDialog', () => {
  it('prefills the customs from the estimate and the price as taxi price + customs', async () => {
    renderDialog(taxi());
    await screen.findByTestId('convert-dialog');
    expect(input('Customs paid').value).toBe('15000');
    expect(input('New asking price').value).toBe('50000');
    expect(plain(screen.getByTestId('convert-summary'))).toBe(
      'Cost as private = taxi price ₪35,000 + customs ₪15,000 = ₪50,000',
    );
  });

  it('recomputes the price while it is untouched, and stops once the user edits it', async () => {
    renderDialog(taxi());
    await screen.findByTestId('convert-dialog');
    fireEvent.change(input('Customs paid'), { target: { value: '12000' } });
    await waitFor(() => expect(input('New asking price').value).toBe('47000'));
    expect(plain(screen.getByTestId('convert-summary'))).toContain('= ₪47,000');

    fireEvent.change(input('New asking price'), { target: { value: '49000' } });
    fireEvent.change(input('Customs paid'), { target: { value: '10000' } });
    await waitFor(() => expect(input('Customs paid').value).toBe('10000'));
    expect(input('New asking price').value).toBe('49000');
  });

  it('warns when the new plate ends in 25 or 26', async () => {
    renderDialog(taxi());
    await screen.findByTestId('convert-dialog');
    fireEvent.change(input('New \\(private\\) plate'), { target: { value: '1234525' } });
    expect(await screen.findByTestId('convert-taxi-plate-warning')).toBeInTheDocument();
    fireEvent.change(input('New \\(private\\) plate'), { target: { value: '1234567' } });
    await waitFor(() => expect(screen.queryByTestId('convert-taxi-plate-warning')).toBeNull());
  });

  it('posts the conversion with the plate as digits and hands over the response', async () => {
    const updated = { id: 'veh_1', plateNo: '1234567', isTaxi: false };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(updated));
    const { onSaved } = renderDialog(taxi());
    await screen.findByTestId('convert-dialog');
    fireEvent.change(input('New \\(private\\) plate'), { target: { value: '123-45-67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/vehicles/veh_1/convert-to-private');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      newPlateNo: '1234567',
      conversionTax: 15000,
      listingPrice: 50000,
    });
  });

  it('shows a duplicate plate error from the server on the plate field', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse(
        {
          statusCode: 409,
          message: 'errors.conflict',
          errors: { newPlateNo: 'validation.duplicate' },
        },
        409,
      ),
    );
    const { onSaved } = renderDialog(taxi());
    await screen.findByTestId('convert-dialog');
    fireEvent.change(input('New \\(private\\) plate'), { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convert' }));
    expect(await screen.findByText('A record with this value already exists')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('lists the blockers, links the licence and disables the button', async () => {
    renderDialog(
      taxi({
        canConvert: { allowed: false, blockers: ['errors.licenseStillRegistered'] },
        registeredLicense: { id: 'lic_9', licenseNo: '12345' },
      }),
    );
    const blockers = await screen.findByTestId('convert-blockers');
    expect(blockers).toHaveTextContent(
      'A taxi licence is still registered on this car; detach it first',
    );
    expect(screen.getByTestId('convert-license-link')).toHaveAttribute(
      'href',
      '/taxi-licenses/lic_9',
    );
    expect(screen.getByRole('button', { name: 'Convert' })).toBeDisabled();
  });
});
