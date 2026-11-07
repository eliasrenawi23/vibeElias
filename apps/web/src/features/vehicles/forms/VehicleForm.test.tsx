import { installValidationErrorMap } from '@renawi/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { VehicleForm } from './VehicleForm';

beforeAll(() => installValidationErrorMap());

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function renderForm(onSubmit = vi.fn(() => Promise.resolve())) {
  renderWithProviders(<VehicleForm onSubmit={onSubmit} submitting={false} />);
  return { onSubmit };
}

const plateInput = () => screen.getByLabelText('Plate number') as HTMLInputElement;

/** Open an AntD select (by its `field-<name>` test id) and pick the option with this label. */
async function chooseOption(testId: string, label: string) {
  const root = screen.getByTestId(testId);
  fireEvent.mouseDown(within(root).getByRole('combobox'));
  const option = await waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
      (el) => el.textContent === label,
    );
    if (!found) throw new Error(`option ${label} not shown`);
    return found;
  });
  fireEvent.click(option);
}

describe('VehicleForm', () => {
  it('formats the plate while typing, left-to-right with the numeric keypad', () => {
    renderForm();
    const input = plateInput();
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('inputmode', 'numeric');

    fireEvent.change(input, { target: { value: '1234567' } });
    expect(input.value).toBe('12-345-67');

    fireEvent.change(input, { target: { value: '123 45 678 9' } });
    expect(input.value).toBe('123-45-678');

    // Arabic-Indic digits typed on an Arabic keyboard become Latin digits.
    fireEvent.change(input, { target: { value: '١٢٣٤٥٦٧٨' } });
    expect(input.value).toBe('123-45-678');
    expect(screen.queryByTestId('taxi-plate-hint')).toBeNull();
  });

  it('shows the taxi-plate hint for plates ending in 25 / 26 and can mark the car as taxi', () => {
    renderForm();
    fireEvent.change(plateInput(), { target: { value: '12345625' } });
    expect(plateInput().value).toBe('123-45-625');
    const hint = screen.getByTestId('taxi-plate-hint');
    expect(hint).toHaveTextContent('Plates ending in 25 or 26 are taxi plates.');
    expect(screen.queryByTestId('taxi-meter-section')).toBeNull();

    fireEvent.click(within(hint).getByRole('button', { name: 'Mark as taxi' }));
    expect(screen.getByRole('checkbox', { name: 'This vehicle is a taxi' })).toBeChecked();
    // Taxis get the meter fields; the hint no longer offers the button.
    expect(screen.getByTestId('taxi-meter-section')).toBeInTheDocument();
    expect(within(screen.getByTestId('taxi-plate-hint')).queryByRole('button')).toBeNull();

    fireEvent.change(plateInput(), { target: { value: '1234526' } });
    expect(screen.getByTestId('taxi-plate-hint')).toBeInTheDocument();
  });

  it('asks for the owner driver only for third-party vehicles', async () => {
    renderForm();
    expect(screen.queryByTestId('owner-driver-field')).toBeNull();

    await chooseOption('field-ownership', 'Third party');
    expect(await screen.findByTestId('owner-driver-field')).toBeInTheDocument();
    expect(screen.getByText('Owner (driver)')).toBeInTheDocument();

    await chooseOption('field-ownership', 'Owned');
    await waitFor(() => expect(screen.queryByTestId('owner-driver-field')).toBeNull());
  });

  it('blocks saving when the picked contact has no driver profile', async () => {
    const contact = {
      id: 'c_1',
      tags: ['DRIVER'],
      firstName: 'Samir',
      lastName: 'Haddad',
      companyName: null,
      idNumber: null,
      phones: [],
      email: null,
      address: null,
      city: null,
      preferredLang: 'ar',
      source: null,
      notes: null,
      followUpAt: null,
      archivedAt: null,
      createdAt: '2026-11-01T08:00:00.000Z',
      updatedAt: '2026-11-01T08:00:00.000Z',
      driver: null,
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        jsonResponse({ items: [contact], total: 1, page: 1, pageSize: 20 }),
      );
    renderForm();
    await chooseOption('field-ownership', 'Third party');

    const picker = await screen.findByTestId('owner-driver-field');
    fireEvent.mouseDown(within(picker).getByRole('combobox'));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/contacts\?.*tag=DRIVER/),
        expect.anything(),
      ),
    );
    const option = await waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
        (el) => el.textContent?.includes('Samir Haddad'),
      );
      if (!found) throw new Error('contact option not shown');
      return found;
    });
    fireEvent.click(option);

    expect(await screen.findByTestId('owner-driver-no-profile')).toHaveTextContent(
      'The owner must be a driver',
    );
    expect(screen.getByTestId('vehicle-save')).toBeDisabled();
  });

  it('submits the parsed values with the plate as canonical digits', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(plateInput(), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2021' } });
    fireEvent.change(within(screen.getByTestId('field-make')).getByRole('combobox'), {
      target: { value: 'Toyota' },
    });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Corolla' } });
    fireEvent.click(screen.getByTestId('vehicle-save'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        plateNo: '12345678',
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        status: 'IN_STOCK',
        ownership: 'OWNED',
        ownerDriverId: null,
        isTaxi: false,
        vin: null,
        meterSerial: null,
      }),
    );
  });

  it('rejects years outside 1990..next year', async () => {
    const { onSubmit } = renderForm();
    fireEvent.change(plateInput(), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1985' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'Corolla' } });
    fireEvent.click(screen.getByTestId('vehicle-save'));
    expect(await screen.findByText('Minimum value is 1990')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
