import { stripBidiMarks } from '@renawi/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import type { DealDetail, TransferChecklistValue } from '../types';
import { TransferChecklist } from './TransferChecklist';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TAXI_CHECKLIST: TransferChecklistValue = {
  idCopies: true,
  vehicleLicenseSigned: true,
  liensChecked: true,
  finesChecked: false,
  transferFiled: false,
  newLicenseReceived: false,
  insuranceHandled: false,
  taxiLicenseDetached: false,
  transferFee: null,
  filedAt: null,
  notes: null,
};

function deal(over: Partial<DealDetail> = {}): DealDetail {
  return {
    id: 'deal_1',
    dealNo: 12,
    type: 'SALE',
    status: 'COMPLETED',
    vehicleId: 'veh_1',
    cycleId: 'cyc_1',
    counterpartyId: 'c_1',
    date: '2026-11-01',
    price: 80000,
    listPrice: null,
    vatMode: 'MARGIN',
    vatRate: 18,
    sellerIsVatBusiness: false,
    isTradeIn: false,
    tradeInDealId: null,
    commissionAmount: null,
    payoutAmount: null,
    warrantyText: null,
    disclosureSignedAt: '2026-11-01T10:00:00.000Z',
    transferStatus: 'IN_PROGRESS',
    transferChecklist: TAXI_CHECKLIST,
    transferDueAt: '2020-01-09',
    transferredAt: null,
    notes: null,
    completedAt: '2026-11-01T10:00:00.000Z',
    cancelledAt: null,
    vehicle: { id: 'veh_1', plateNo: '12345625', make: 'Toyota', model: 'Corolla' },
    counterparty: { id: 'c_1', name: 'Nadia Buyer' },
    paidIn: 80000,
    paidOut: 0,
    balanceDue: 0,
    payoutDue: null,
    tradeInValue: null,
    alerts: ['transferOverdue'],
    cycle: null,
    tradeInDeal: null,
    tradeInFor: null,
    payments: [],
    vat: { mode: 'MARGIN', rate: 18, base: 20000, amount: 3050.85 },
    documentCount: 0,
    ...over,
  };
}

describe('TransferChecklist', () => {
  it('rolls up the ticked items of a taxi (incl. detaching the taxi licence)', () => {
    renderWithProviders(<TransferChecklist deal={deal()} onSaved={vi.fn()} />);
    const card = screen.getByTestId('transfer-checklist');
    expect(card).toHaveAttribute('data-done', '3');
    expect(card).toHaveAttribute('data-total', '8');
    expect(stripBidiMarks(screen.getByTestId('transfer-progress-text').textContent ?? '')).toBe(
      '3 of 8 done',
    );
    const boxes = within(card).getAllByRole('checkbox');
    expect(boxes).toHaveLength(8);
    expect(within(card).getByRole('checkbox', { name: 'ID copies collected' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Taxi licence detached' })).not.toBeChecked();
    // Past the 6-working-day deadline and not done: overdue badge.
    expect(card.querySelector('[data-transfer-due="overdue"]')).toHaveTextContent('Overdue');
    expect(screen.getByTestId('transfer-mark-done')).toBeInTheDocument();
  });

  it('leaves out the taxi item for other cars and shows a done transfer', () => {
    const { taxiLicenseDetached: _taxi, ...car } = TAXI_CHECKLIST;
    const all = Object.fromEntries(
      Object.entries(car).map(([k, v]) => [k, typeof v === 'boolean' ? true : v]),
    );
    renderWithProviders(
      <TransferChecklist
        deal={deal({
          transferChecklist: all,
          transferStatus: 'DONE',
          transferredAt: '2026-11-05',
          alerts: [],
        })}
        onSaved={vi.fn()}
      />,
    );
    const card = screen.getByTestId('transfer-checklist');
    expect(card).toHaveAttribute('data-done', '7');
    expect(card).toHaveAttribute('data-total', '7');
    expect(within(card).queryByRole('checkbox', { name: 'Taxi licence detached' })).toBeNull();
    expect(screen.getByTestId('transfer-done')).toBeInTheDocument();
    expect(screen.queryByTestId('transfer-mark-done')).toBeNull();
    expect(card.querySelector('[data-transfer-due]')).toBeNull();
  });

  it('saves each tick at once with only the changed item', async () => {
    const updated = deal({ transferChecklist: { ...TAXI_CHECKLIST, finesChecked: true } });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(updated));
    const onSaved = vi.fn();
    renderWithProviders(<TransferChecklist deal={deal()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Outstanding fines checked' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('/api/deals/deal_1/transfer');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({ checklist: { finesChecked: true } });
  });
  it('shows the saved fee and filing date and saves the transfer details together', async () => {
    const saved = deal({
      transferChecklist: {
        ...TAXI_CHECKLIST,
        transferFee: 257,
        filedAt: null,
        notes: 'Filed online',
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(saved));
    const onSaved = vi.fn();
    renderWithProviders(
      <TransferChecklist
        deal={deal({ transferChecklist: { ...TAXI_CHECKLIST, transferFee: 43 } })}
        onSaved={onSaved}
      />,
    );
    expect(screen.getByTestId('transfer-fee-value')).toHaveTextContent('₪43.00');
    const details = screen.getByTestId('transfer-details');
    // Nothing changed yet: saving is disabled.
    expect(within(details).getByTestId('transfer-details-save')).toBeDisabled();

    fireEvent.change(within(details).getByLabelText('Transfer fee'), {
      target: { value: '257' },
    });
    fireEvent.change(within(details).getByLabelText('Notes'), {
      target: { value: '  Filed online ' },
    });
    fireEvent.click(within(details).getByTestId('transfer-details-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]).toEqual(saved);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('/api/deals/deal_1/transfer');
    expect(init?.method).toBe('PATCH');
    // Only the three details (trimmed), never the ticks.
    expect(JSON.parse(String(init?.body))).toEqual({
      checklist: { transferFee: 257, filedAt: null, notes: 'Filed online' },
    });
  });
});
