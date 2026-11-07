import { VehicleStatus } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { StatusDialog } from './StatusDialog';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function renderDialog(status: VehicleStatus, onSaved = vi.fn()) {
  renderWithProviders(
    <StatusDialog vehicleId="veh_1" status={status} onClose={vi.fn()} onSaved={onSaved} />,
  );
  return { onSaved };
}

const radioLabels = () =>
  screen.queryAllByRole('radio').map((r) => r.closest('label')?.textContent?.trim());

/** Allowed manual targets (the API's transition table) with their English labels. */
const EXPECTED: Record<VehicleStatus, string[]> = {
  IN_STOCK: ['Reserved', 'Scrapped'],
  RESERVED: ['In stock'],
  LEASED: ['In stock'],
  EXTERNAL: ['In stock'],
  SOLD: [],
  RETURNED: [],
  SCRAPPED: [],
};

describe('StatusDialog', () => {
  it.each(VehicleStatus.options)('offers only the allowed targets from %s', async (status) => {
    renderDialog(status);
    await screen.findByTestId('status-dialog');
    expect(radioLabels()).toEqual(EXPECTED[status]);
    const ok = screen.getByRole('button', { name: 'Save' });
    if (EXPECTED[status].length === 0) {
      expect(screen.getByTestId('status-no-targets')).toHaveTextContent(
        'No status change is available from the current status.',
      );
      expect(ok).toBeDisabled();
    } else {
      expect(screen.queryByTestId('status-no-targets')).toBeNull();
      expect(ok).toBeEnabled();
      // The first allowed target is preselected.
      expect(screen.getAllByRole('radio')[0]).toBeChecked();
    }
    // Sales are recorded as deals, never through this dialog.
    expect(
      screen.getByText('To mark the vehicle as sold, record a sale deal.'),
    ).toBeInTheDocument();
  });

  it('posts the chosen status and note', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse({ id: 'veh_1', status: 'SCRAPPED' }));
    const { onSaved } = renderDialog('IN_STOCK');
    fireEvent.click(await screen.findByRole('radio', { name: 'Scrapped' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Engine failure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/vehicles/veh_1/status');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ status: 'SCRAPPED', note: 'Engine failure' });
  });

  it('shows the API reason when the change is refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse({ statusCode: 409, message: 'errors.invalidTransition' }, 409),
    );
    const { onSaved } = renderDialog('RESERVED');
    await screen.findByTestId('status-dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('This status change is not allowed')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
