import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from '../app/providers/I18nProvider';
import { UiProvider } from '../app/providers/UiProvider';

/** Render inside the app's query client (no retries), i18n and AntD providers. */
export function renderWithProviders(ui: ReactElement): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <UiProvider>{ui}</UiProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

/** A JSON `Response` for `fetch` mocks. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
