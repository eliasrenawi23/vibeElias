import { VehicleStatus } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../app/i18n';
import { VehicleInventoryTab } from '../../features/vehicles/components/VehicleInventoryTab';
import { jsonResponse, renderWithProviders } from '../../test/renderWithProviders';
import { StatusSummaryCards } from './StatusSummaryCards';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const COUNTS = {
  IN_STOCK: 4,
  RESERVED: 1,
  LEASED: 6,
  SOLD: 12,
  RETURNED: 0,
  SCRAPPED: 0,
  EXTERNAL: 2,
};

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const params = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');

describe('StatusSummaryCards', () => {
  it('shows a count per status and toggles the status param', async () => {
    const load = vi.fn().mockResolvedValue({ counts: COUNTS });
    renderWithProviders(
      <MemoryRouter initialEntries={['/vehicles?status=IN_STOCK&q=toyota&page=3']}>
        <StatusSummaryCards
          enumName="VehicleStatus"
          statuses={VehicleStatus.options}
          queryKey={['test-summary']}
          load={load}
        />
        <Search />
      </MemoryRouter>,
    );
    const inStock = screen.getByTestId('summary-card-IN_STOCK');
    await waitFor(() => expect(inStock).toHaveTextContent('4In stock'));
    expect(screen.getByTestId('summary-card-SOLD')).toHaveTextContent('12Sold');
    expect(screen.getAllByRole('button')).toHaveLength(VehicleStatus.options.length);
    expect(inStock).toHaveAttribute('aria-pressed', 'true');
    expect(inStock).toHaveClass('rm-summary-card-active', 'rm-tone-info');
    const reserved = screen.getByRole('button', { name: /Reserved/ });
    expect(reserved).toHaveAttribute('aria-pressed', 'false');
    expect(reserved).toHaveClass('rm-tone-warning');

    // Adding a status keeps the other filters and goes back to page 1.
    fireEvent.click(reserved);
    expect(params().get('status')).toBe('IN_STOCK,RESERVED');
    expect(params().get('q')).toBe('toyota');
    expect(params().has('page')).toBe(false);
    expect(reserved).toHaveAttribute('aria-pressed', 'true');

    // Removing both drops the param.
    fireEvent.click(inStock);
    expect(params().get('status')).toBe('RESERVED');
    fireEvent.click(reserved);
    expect(params().has('status')).toBe(false);
    expect(params().get('q')).toBe('toyota');
  });

  it('is hidden when the summary cannot be loaded', async () => {
    const load = vi.fn().mockRejectedValue(new Error('down'));
    renderWithProviders(
      <MemoryRouter initialEntries={['/vehicles']}>
        <StatusSummaryCards
          enumName="VehicleStatus"
          statuses={VehicleStatus.options}
          queryKey={['test-summary-error']}
          load={load}
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByTestId('status-summary')).toBeNull());
  });

  it('requests the vehicle summary with the list filters except status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/vehicles/summary') return jsonResponse({ counts: COUNTS });
      return jsonResponse({ items: [], total: 0, page: 1, pageSize: 25 });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(
      <MemoryRouter initialEntries={['/vehicles?status=SOLD&q=toyota&taxi=1&page=2']}>
        <VehicleInventoryTab />
        <Search />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('summary-card-SOLD')).toHaveAttribute('aria-pressed', 'true'),
    );
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'));
    const summary = urls.find((u) => u.pathname === '/api/vehicles/summary');
    expect(summary?.searchParams.get('q')).toBe('toyota');
    expect(summary?.searchParams.get('isTaxi')).toBe('true');
    expect(summary?.searchParams.has('status')).toBe(false);
    expect(summary?.searchParams.has('page')).toBe(false);
    const list = urls.find((u) => u.pathname === '/api/vehicles');
    expect(list?.searchParams.get('status')).toBe('SOLD');

    // Clicking a card filters the list; the summary is not asked again for a status change.
    fireEvent.click(screen.getByTestId('summary-card-LEASED'));
    expect(params().get('status')).toBe('SOLD,LEASED');
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([input]) => String(input).includes('/api/vehicles?') && String(input).includes('LEASED'),
        ),
      ).toBe(true),
    );
    const summaryCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith('/api/vehicles/summary'),
    );
    expect(summaryCalls).toHaveLength(1);
  });
});
