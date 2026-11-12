import { todayInBusinessTz } from '@renawi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { presetRange } from '../lib/datePresets';
import { FilterBar, staleFilterValues, type FilterDef } from './FilterBar';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}
const params = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');

const FILTERS: FilterDef[] = [
  { type: 'dateRange', keys: ['from', 'to'], label: 'Period', presets: true },
  {
    type: 'select',
    key: 'groupBy',
    label: 'Group by',
    options: [
      { value: 'month', label: 'Month' },
      { value: 'year', label: 'Year' },
    ],
  },
  {
    type: 'chips',
    key: 'severity',
    label: 'Urgency',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'due', label: 'Due soon' },
    ],
  },
];

function renderBar(url: string) {
  renderWithProviders(
    <MemoryRouter initialEntries={[url]}>
      <FilterBar searchKey={null} filters={FILTERS} defaults={{ groupBy: 'month' }} />
      <Search />
    </MemoryRouter>,
  );
}

describe('FilterBar period presets', () => {
  it('sets the dates of a preset and highlights the preset matching the dates', () => {
    renderBar('/reports/profit?page=2');
    const lastMonth = screen.getByTestId('preset-lastMonth');
    fireEvent.click(lastMonth);
    const [from, to] = presetRange('lastMonth', todayInBusinessTz());
    expect(params().get('from')).toBe(from);
    expect(params().get('to')).toBe(to);
    expect(params().has('page')).toBe(false);
    expect(screen.getByTestId('preset-lastMonth')).toHaveClass('ant-tag-checkable-checked');
    expect(screen.getByTestId('preset-thisMonth')).not.toHaveClass('ant-tag-checkable-checked');
    // A second click on the active preset clears the range.
    fireEvent.click(screen.getByTestId('preset-lastMonth'));
    expect(params().has('from')).toBe(false);
    expect(params().has('to')).toBe(false);
  });

  it('loses the highlight on a hand-picked range', () => {
    renderBar('/reports/profit?from=2026-02-03&to=2026-02-17');
    for (const p of ['thisMonth', 'lastMonth', 'yearToDate', 'lastYear', 'last30Days']) {
      expect(screen.getByTestId(`preset-${p}`)).not.toHaveClass('ant-tag-checkable-checked');
    }
  });
});

describe('FilterBar defaults and stale values', () => {
  it('does not count a default as a filter', () => {
    renderBar('/reports/profit?groupBy=month');
    expect(screen.queryByTestId('filter-clear')).toBeNull();
  });

  it('offers "Clear filters" when something differs, and clears it', () => {
    renderBar('/reports/profit?groupBy=year&severity=due');
    fireEvent.click(screen.getByTestId('filter-clear'));
    expect(params().toString()).toBe('');
  });

  it('drops selections that are not among the options', async () => {
    expect(
      staleFilterValues(FILTERS, new URLSearchParams('groupBy=decade&severity=due,ancient')),
    ).toEqual({ groupBy: null, severity: 'due' });
    renderBar('/reports/profit?groupBy=decade&severity=due,ancient&from=2026-01-01');
    await waitFor(() => expect(params().get('severity')).toBe('due'));
    expect(params().has('groupBy')).toBe(false);
    expect(params().get('from')).toBe('2026-01-01');
  });
});
