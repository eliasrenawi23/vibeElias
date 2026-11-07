import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { balanceState, BalanceText } from './BalanceText';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('balanceState', () => {
  it.each([
    [1500, 'owes'],
    [0.01, 'owes'],
    [0, 'zero'],
    [0.004, 'zero'],
    [-0.004, 'zero'],
    [null, 'zero'],
    [-250, 'credit'],
    ['-0.01', 'credit'],
  ] as const)('%s -> %s', (amount, state) => {
    expect(balanceState(amount)).toBe(state);
  });
});

describe('BalanceText', () => {
  it('shows a positive balance (the driver owes us) in red', () => {
    renderWithProviders(<BalanceText amount={1500} />);
    const el = screen.getByTestId('balance-text');
    expect(el).toHaveAttribute('data-balance', 'owes');
    expect(el).toHaveClass('rm-balance-owes');
    expect(el).toHaveTextContent('₪1,500.00');
  });

  it('shows zero in grey', () => {
    renderWithProviders(<BalanceText amount={0} />);
    const el = screen.getByTestId('balance-text');
    expect(el).toHaveAttribute('data-balance', 'zero');
    expect(el).toHaveClass('rm-balance-zero');
    expect(el).toHaveTextContent('₪0.00');
  });

  it('shows a negative balance (credit in the driver favour) in green, with its sign', () => {
    renderWithProviders(<BalanceText amount={-250} />);
    const el = screen.getByTestId('balance-text');
    expect(el).toHaveAttribute('data-balance', 'credit');
    expect(el).toHaveClass('rm-balance-credit');
    expect(el).toHaveTextContent('-₪250.00');
  });

  it('keeps the amount an LTR isolate in Arabic (Latin digits)', async () => {
    await act(() => i18n.changeLanguage('ar'));
    renderWithProviders(<BalanceText amount={1234.5} />);
    const el = screen.getByTestId('balance-text');
    expect(el.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
    expect(el.textContent).toMatch(/1,234\.50/);
    expect(el.textContent).not.toMatch(/[٠-٩]/);
  });
});
