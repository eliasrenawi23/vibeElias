import type { ReportResult } from '@renawi/shared';
import { act, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../../app/i18n';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { mockViewport } from '../../../test/viewport';
import { reportDef, reportExportHref, reportQuery } from '../lib/reports';
import { ReportTable } from './ReportTable';

let restoreViewport = () => {};

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
  restoreViewport = mockViewport('desktop');
});

afterEach(() => {
  restoreViewport();
});

const RESULT: ReportResult = {
  report: 'trade-book',
  params: { from: '2026-01-01', to: '2026-11-12' },
  columns: [
    { key: 'plateNo', label: 'reports.columns.plateNo', type: 'plate' },
    { key: 'status', label: 'reports.columns.status', type: 'enum', enum: 'VehicleStatus' },
    { key: 'purchaseDate', label: 'reports.columns.purchaseDate', type: 'date' },
    { key: 'salePrice', label: 'reports.columns.salePrice', type: 'money' },
    { key: 'daysInStock', label: 'reports.columns.daysInStock', type: 'int' },
    { key: 'consignment', label: 'reports.columns.consignment', type: 'bool' },
    { key: 'sellerName', label: 'reports.columns.sellerName', type: 'text' },
    { key: 'mystery', label: 'reports.columns.notAKey', type: 'text' },
  ],
  rows: [
    {
      plateNo: '1234567',
      status: 'SOLD',
      purchaseDate: '2026-03-05',
      salePrice: 72500,
      daysInStock: 1204,
      consignment: false,
      sellerName: 'דני כהן',
      mystery: 'x',
    },
    {
      plateNo: '12345678',
      status: 'IN_STOCK',
      purchaseDate: null,
      salePrice: null,
      daysInStock: 12,
      consignment: true,
      sellerName: null,
      mystery: null,
    },
  ],
  totals: {
    plateNo: null,
    status: null,
    purchaseDate: null,
    salePrice: 72500,
    daysInStock: null,
    consignment: null,
    sellerName: null,
    mystery: null,
  },
};

describe('ReportTable', () => {
  it('renders every cell by its column type, missing values as n/a, and the totals row', () => {
    renderWithProviders(
      <MemoryRouter>
        <ReportTable result={RESULT} label="Trade book" />
      </MemoryRouter>,
    );
    const table = screen.getByTestId('report-table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      'Plate number',
      'Status',
      'Purchase date',
      'Sale price',
      'Days in stock',
      'Consignment',
      'Seller',
      // Unknown label keys fall back to the column key.
      'mystery',
    ]);

    const [first, second] = within(table).getAllByRole('row').slice(1);
    const cells = within(first!).getAllByRole('cell');
    expect(cells[0]?.querySelector('bdi.rm-plate')).toHaveTextContent('12-345-67');
    expect(cells[1]).toHaveTextContent('Sold');
    expect(cells[2]?.querySelector('time')).toHaveAttribute('dateTime', '2026-03-05');
    expect(cells[2]).toHaveTextContent('05/03/2026');
    expect(cells[3]).toHaveTextContent('₪72,500.00');
    expect(cells[4]).toHaveTextContent('1,204');
    expect(cells[5]).toHaveTextContent('No');
    expect(cells[6]?.querySelector('bdi[dir="auto"]')).toHaveTextContent('דני כהן');

    const missing = within(second!).getAllByRole('cell');
    expect(missing[1]).toHaveTextContent('In stock');
    expect(missing[2]).toHaveTextContent('n/a');
    // A missing amount is "n/a", never 0.
    expect(missing[3]).toHaveTextContent('n/a');
    expect(missing[3]).not.toHaveTextContent('0');
    expect(missing[5]).toHaveTextContent('Yes');
    expect(second!.querySelectorAll('[data-na]')).toHaveLength(4);

    const totals = screen.getAllByTestId('report-totals')[0]!;
    const totalCells = within(totals).getAllByRole('cell');
    expect(totalCells[0]).toHaveTextContent('Total');
    expect(totalCells[3]).toHaveTextContent('₪72,500.00');
    expect(totalCells[4]).toHaveTextContent('');
  });

  it('lists rows as cards with a totals card on phones', () => {
    restoreViewport();
    restoreViewport = mockViewport('phone');
    renderWithProviders(
      <MemoryRouter>
        <ReportTable result={RESULT} label="Trade book" />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    const totals = screen.getByTestId('report-totals');
    expect(totals).toHaveTextContent('Total');
    expect(totals).toHaveTextContent('Sale price');
    expect(totals).toHaveTextContent('₪72,500.00');
  });

  it('shows "no data" without a totals row for an empty result', () => {
    renderWithProviders(
      <MemoryRouter>
        <ReportTable result={{ ...RESULT, rows: [] }} label="Trade book" />
      </MemoryRouter>,
    );
    expect(screen.getByText('No data for these parameters')).toBeInTheDocument();
    expect(screen.queryByTestId('report-totals')).toBeNull();
  });
});

describe('report links', () => {
  it('reads only the report parameters from the page URL', () => {
    const profit = reportDef('profit')!;
    const search = new URLSearchParams('from=2026-11-01&to=2026-11-12&groupBy=quarter&page=3&x=1');
    expect(reportQuery(profit, search)).toEqual({
      from: '2026-11-01',
      to: '2026-11-12',
      groupBy: 'quarter',
    });
    const receivables = reportDef('receivables')!;
    expect(reportQuery(receivables, new URLSearchParams('asOf=2026-10-31&from=2026-01-01'))).toEqual({
      asOf: '2026-10-31',
    });
    expect(reportQuery(reportDef('fines')!, new URLSearchParams('status=NEW,PAID_BY_US'))).toEqual({
      status: 'NEW,PAID_BY_US',
    });
    expect(reportDef('nope')).toBeNull();
  });

  it('builds the export links with the same query, the format and the UI language', () => {
    const href = reportExportHref(
      'profit',
      { from: '2026-11-01', to: '2026-11-12', groupBy: 'month' },
      'csv',
      'ar',
    );
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/api/reports/profit');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: '2026-11-01',
      to: '2026-11-12',
      groupBy: 'month',
      format: 'csv',
      lang: 'ar',
    });
    expect(reportExportHref('trade-book', {}, 'xlsx', 'en-US')).toBe(
      '/api/reports/trade-book?format=xlsx&lang=en',
    );
  });
});
