import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../app/i18n';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { profitState } from '../../../shared/ui/ProfitText';
import type { CyclePnl, VehiclePnl } from '../types';
import { VehiclePnlView } from './VehiclePnlTab';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function cycle(over: Partial<CyclePnl>): CyclePnl {
  return {
    id: 'cyc',
    kind: 'OWNED',
    startedAt: '2025-01-01',
    endedAt: '2025-06-01',
    open: false,
    purchasePrice: 60000,
    salePrice: 75000,
    listingPrice: null,
    commission: null,
    revenue: { sale: 75000, commission: 0, leaseIncome: 0, rebilled: 0, total: 75000 },
    costs: { purchase: 60000, expenses: 3000, vatOnMargin: 2288.14, total: 65288.14 },
    profit: 9711.86,
    unrealised: false,
    ...over,
  };
}

const PNL: VehiclePnl = {
  cycles: [
    cycle({ id: 'cyc_sold' }),
    cycle({
      id: 'cyc_loss',
      startedAt: '2025-07-01',
      endedAt: '2025-12-01',
      salePrice: 50000,
      revenue: { sale: 50000, commission: 0, leaseIncome: 1500, rebilled: 0, total: 51500 },
      costs: { purchase: 55000, expenses: 1000, vatOnMargin: 0, total: 56000 },
      profit: -4500,
    }),
    cycle({
      id: 'cyc_open',
      startedAt: '2026-09-01',
      endedAt: null,
      open: true,
      salePrice: null,
      listingPrice: 72000,
      revenue: { sale: 72000, commission: 0, leaseIncome: 0, rebilled: 0, total: 72000 },
      costs: { purchase: 70000, expenses: 2000, vatOnMargin: 0, total: 72000 },
      profit: 0,
      unrealised: true,
    }),
  ],
  totals: { revenue: 198500, costs: 193288.14, profit: 5211.86 },
};

describe('profitState', () => {
  it.each([
    [100, 'profit'],
    [0.004, 'zero'],
    [0, 'zero'],
    [null, 'zero'],
    [-0.01, 'loss'],
  ] as const)('%s -> %s', (amount, state) => {
    expect(profitState(amount)).toBe(state);
  });
});

describe('VehiclePnlView', () => {
  it('colours profit green, a loss red and zero grey, and flags the open cycle', () => {
    renderWithProviders(<VehiclePnlView pnl={PNL} emptyText="none" />);
    const cards = screen.getAllByTestId('pnl-cycle');
    // Newest cycle first.
    expect(cards.map((c) => c.getAttribute('data-cycle'))).toEqual([
      'cyc_open',
      'cyc_loss',
      'cyc_sold',
    ]);
    const profitOf = (card: HTMLElement) => within(card).getByTestId('pnl-cycle-profit');

    const [open, loss, sold] = cards as [HTMLElement, HTMLElement, HTMLElement];
    expect(profitOf(sold)).toHaveAttribute('data-profit', 'profit');
    expect(profitOf(sold)).toHaveClass('rm-profit-positive');
    expect(profitOf(sold)).toHaveTextContent('₪9,711.86');

    expect(profitOf(loss)).toHaveAttribute('data-profit', 'loss');
    expect(profitOf(loss)).toHaveClass('rm-profit-negative');
    expect(profitOf(loss)).toHaveTextContent('-₪4,500.00');
    expect(within(loss).getByTestId('pnl-revenue')).toHaveTextContent('Lease income');

    expect(profitOf(open)).toHaveAttribute('data-profit', 'zero');
    expect(profitOf(open)).toHaveClass('rm-profit-zero');
    expect(within(open).getByTestId('pnl-unrealised')).toHaveTextContent('Unrealised');
    expect(within(sold).queryByTestId('pnl-unrealised')).toBeNull();
    expect(open).toHaveTextContent('Estimated profit');

    const totals = screen.getByTestId('pnl-totals');
    expect(totals).toHaveTextContent('₪198,500.00');
    expect(totals).toHaveTextContent('₪193,288.14');
    expect(within(totals).getByTestId('pnl-total-profit')).toHaveAttribute('data-profit', 'profit');
  });

  it('shows the empty text without cycles', () => {
    renderWithProviders(
      <VehiclePnlView
        pnl={{ cycles: [], totals: { revenue: 0, costs: 0, profit: 0 } }}
        emptyText="No inventory cycles yet"
      />,
    );
    expect(screen.getByText('No inventory cycles yet')).toBeInTheDocument();
    expect(screen.queryByTestId('pnl-totals')).toBeNull();
  });
});
