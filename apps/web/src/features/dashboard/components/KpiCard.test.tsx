import { CarOutlined } from '@ant-design/icons';
import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../app/i18n';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { profitChange } from '../lib/kpis';
import { KpiCard } from './KpiCard';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('KpiCard', () => {
  it('shows "—" with the reason when the value is missing, never a fake 0', () => {
    renderWithProviders(
      <KpiCard title="Open fines" value={undefined} icon={<CarOutlined />} data-testid="kpi" />,
    );
    const card = screen.getByTestId('kpi');
    expect(card).toHaveAttribute('data-missing', 'true');
    expect(card.querySelector('.ant-statistic-content')).toHaveTextContent('—');
    expect(card.querySelector('.ant-statistic-content')).not.toHaveTextContent('0');
    expect(screen.getByTestId('kpi-sub')).toHaveTextContent('Not reported by the server yet');
  });

  it('formats counts and amounts with Latin digits, compact from 100,000', () => {
    renderWithProviders(
      <>
        <KpiCard title="Cars" value={1284} icon={<CarOutlined />} data-testid="count" />
        <KpiCard
          title="Owed"
          value={18500}
          format="money"
          icon={<CarOutlined />}
          data-testid="money"
        />
        <KpiCard
          title="Big"
          value={1250000}
          format="money"
          icon={<CarOutlined />}
          data-testid="big"
        />
      </>,
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1,284');
    expect(screen.getByTestId('money')).toHaveTextContent('₪18,500');
    expect(screen.getByTestId('big')).toHaveTextContent('₪1.3M');
  });

  it('colours a profit, highlights an alert and shows the trend and the sub-line', () => {
    renderWithProviders(
      <>
        <KpiCard
          title="Profit"
          value={-2500}
          format="profit"
          icon={<CarOutlined />}
          trend={{ direction: 'down', label: 'Down ₪800 from last month', tone: 'error' }}
          data-testid="profit"
        />
        <KpiCard
          title="Late"
          value={2}
          alert
          sub="2 due soon"
          icon={<CarOutlined />}
          data-testid="late"
        />
        <KpiCard title="None late" value={0} alert icon={<CarOutlined />} data-testid="none" />
      </>,
    );
    expect(screen.getByTestId('kpi-profit')).toHaveAttribute('data-profit', 'loss');
    const trend = screen.getByTestId('profit').querySelector('[data-trend="down"]');
    expect(trend).toHaveTextContent('Down ₪800 from last month');
    expect(trend).toHaveClass('rm-tone-error');
    expect(screen.getByTestId('late')).toHaveClass('rm-kpi-alert');
    expect(screen.getByTestId('late-sub')).toHaveTextContent('2 due soon');
    expect(screen.getByTestId('none')).not.toHaveClass('rm-kpi-alert');
  });
});

describe('profitChange', () => {
  const month = (period: string, profit: number) => ({
    period,
    sales: 0,
    leaseIncome: 0,
    commission: 0,
    costs: 0,
    profit,
  });

  it('compares the current month with the previous one', () => {
    expect(profitChange([month('2026-10', 1000), month('2026-11', 1800)])).toEqual({
      direction: 'up',
      delta: 800,
    });
    expect(profitChange([month('2026-10', 1000), month('2026-11', 200)])).toEqual({
      direction: 'down',
      delta: 800,
    });
    expect(profitChange([month('2026-10', 500), month('2026-11', 500)])).toEqual({
      direction: 'flat',
      delta: 0,
    });
    expect(profitChange([month('2026-11', 500)])).toBeNull();
    expect(profitChange(undefined)).toBeNull();
  });
});
