import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { PlateChange } from '../types';
import { PlateHistoryCard } from './PlateHistoryCard';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

const CHANGE: PlateChange = {
  id: 'pc_1',
  oldPlateNo: '8473126',
  newPlateNo: '1234567',
  changedAt: '2026-11-20',
  reason: 'TAXI_TO_PRIVATE',
  conversionTax: 15000,
  notes: 'Paid at the customs office',
};

describe('PlateHistoryCard', () => {
  it('shows the old and new plate, reason, customs and notes', () => {
    renderWithProviders(<PlateHistoryCard history={[CHANGE]} />);
    const row = screen.getByTestId('plate-change');
    expect(row).toHaveTextContent('84-731-26');
    expect(row).toHaveTextContent('12-345-67');
    expect(row).toHaveTextContent('Converted from taxi to private');
    expect(row).toHaveTextContent('Customs ₪15,000.00');
    expect(row).toHaveTextContent('Paid at the customs office');
  });

  it('offers the correction only for a conversion and calls back', () => {
    const onCorrect = vi.fn();
    const { unmount } = renderWithProviders(
      <PlateHistoryCard history={[CHANGE]} onCorrect={onCorrect} />,
    );
    fireEvent.click(screen.getByTestId('plate-history-correct'));
    expect(onCorrect).toHaveBeenCalledTimes(1);
    unmount();

    renderWithProviders(
      <PlateHistoryCard history={[{ ...CHANGE, reason: 'OTHER' }]} onCorrect={onCorrect} />,
    );
    expect(screen.queryByTestId('plate-history-correct')).toBeNull();
  });

  it('shows an empty state without history', () => {
    renderWithProviders(<PlateHistoryCard history={[]} />);
    expect(screen.getByText('The plate has never changed')).toBeInTheDocument();
  });
});
