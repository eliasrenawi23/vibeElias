import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { GeneratePdfDialog } from './GeneratePdf';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const DOCUMENT = {
  id: 'doc_pdf',
  kind: 'HANDOVER',
  fileName: 'handover-1001.pdf',
  mime: 'application/pdf',
  size: 48213,
  hasThumb: false,
  title: 'Handover report',
  lang: 'ar',
  expiresAt: null,
  createdAt: '2026-11-12T10:00:00.000Z',
  url: '/api/documents/doc_pdf/file',
};

function stubApi(status = 201, body: unknown = DOCUMENT) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    jsonResponse(body, status),
  );
  vi.stubGlobal('fetch', fetchMock);
  const tab = { opener: window, closed: false, location: { href: '' }, close: vi.fn() };
  const open = vi.fn(() => tab as unknown as Window);
  vi.stubGlobal('open', open);
  return { fetchMock, open, tab };
}

describe('GeneratePdfDialog', () => {
  it('posts the chosen template and language, then opens the document', async () => {
    const { fetchMock, open, tab } = stubApi();
    const onClose = vi.fn();
    const onGenerated = vi.fn();
    const { queryClient } = renderWithProviders(
      <GeneratePdfDialog
        choices={[
          { template: 'lease-contract', id: 'lc_1' },
          { template: 'handover', id: 'lc_1' },
        ]}
        onClose={onClose}
        onGenerated={onGenerated}
      />,
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    expect(screen.getByRole('radio', { name: 'Lease agreement' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Handover report' }));
    fireEvent.click(screen.getByText('Arabic'));
    fireEvent.click(screen.getByTestId('pdf-generate'));

    await waitFor(() => expect(onGenerated).toHaveBeenCalled());
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(String(input)).toBe('/api/pdf/handover/lc_1?lang=ar');
    expect(init?.method).toBe('POST');
    // The tab is opened at the click (popup blockers) and shows the file once it is stored.
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('/api/documents/doc_pdf/file');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documents'] });
    expect(onClose).toHaveBeenCalled();
  });

  it("leaves the language to the API by default (the customer's language)", async () => {
    const { fetchMock } = stubApi();
    renderWithProviders(
      <GeneratePdfDialog
        choices={[{ template: 'sale-agreement', id: 'deal 1' }]}
        onClose={() => {}}
      />,
    );
    // A single template is named, not offered as a choice.
    expect(screen.queryByTestId('pdf-template')).toBeNull();
    expect(screen.getByText('Sale agreement')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pdf-generate'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/pdf/sale-agreement/deal%201');
  });

  it('shows the translated reason when the template does not fit the record', async () => {
    const { tab } = stubApi(409, { statusCode: 409, message: 'errors.pdfNotApplicable' });
    const onClose = vi.fn();
    renderWithProviders(
      <GeneratePdfDialog choices={[{ template: 'return', id: 'lc_1' }]} onClose={onClose} />,
    );
    fireEvent.click(screen.getByTestId('pdf-generate'));
    expect(
      await screen.findByText('This document cannot be generated for this record'),
    ).toBeInTheDocument();
    // The tab reserved for it is closed again.
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('');
    expect(onClose).not.toHaveBeenCalled();
  });
});
