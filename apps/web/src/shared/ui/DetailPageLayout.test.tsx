import { act, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../app/i18n';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DetailPageLayout, type DetailPageLayoutProps } from './DetailPageLayout';
import { ToneTag } from './ToneTag';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderLayout(props: Partial<DetailPageLayoutProps<'edit' | 'close'>> = {}) {
  const onAction = vi.fn();
  renderWithProviders(
    <MemoryRouter initialEntries={['/things/1']}>
      <DetailPageLayout<'edit' | 'close'>
        testId="thing"
        breadcrumbs={[{ title: 'Things', to: '/things' }, { title: 'Thing 1' }]}
        title="Thing 1"
        subtitle="The first thing"
        tags={<ToneTag tone="success">Active</ToneTag>}
        actions={{
          actions: [
            { key: 'edit', label: 'Edit', primary: true },
            { key: 'close', label: 'Close it', danger: true },
          ],
          onAction,
          menuLabel: 'Thing actions',
          testIdPrefix: 'thing-action',
        }}
        lifecycle={<div data-testid="lifecycle-slot" />}
        facts={<span>Plate 12-345-67</span>}
        tabs={[
          { key: 'info', label: 'Info', children: <p>Info tab</p> },
          { key: 'money', label: 'Money', children: <p>Money tab</p> },
        ]}
        {...props}
      />
      <Search />
    </MemoryRouter>,
  );
  return { onAction };
}

describe('DetailPageLayout', () => {
  it('renders breadcrumbs, title, tags, facts, lifecycle and the first tab', () => {
    renderLayout();
    const crumbs = screen.getByTestId('breadcrumbs');
    expect(crumbs).toHaveTextContent(i18n.t('breadcrumbs.home'));
    expect(screen.getByRole('link', { name: 'Things' })).toHaveAttribute('href', '/things');
    expect(screen.getByText('Thing 1', { selector: '.rm-breadcrumb-current' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Thing 1' })).toBeInTheDocument();
    expect(screen.getByTestId('thing-tags')).toHaveTextContent('Active');
    expect(screen.getByTestId('thing-facts')).toHaveTextContent('Plate 12-345-67');
    expect(screen.getByTestId('lifecycle-slot')).toBeInTheDocument();
    expect(screen.getByText('Info tab')).toBeInTheDocument();
  });

  it('puts the actions in the ActionBar (phone menu in jsdom, which has no width)', async () => {
    const { onAction } = renderLayout();
    fireEvent.click(screen.getByTestId('thing-actions-menu'));
    fireEvent.click(await screen.findByText('Close it'));
    expect(onAction).toHaveBeenCalledWith('close');
  });

  it('keeps the active tab in ?tab= (none for the first tab)', async () => {
    renderLayout();
    fireEvent.click(screen.getByRole('tab', { name: 'Money' }));
    expect(await screen.findByText('Money tab')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?tab=money');
    fireEvent.click(screen.getByRole('tab', { name: 'Info' }));
    expect(await screen.findByText('Info tab')).toBeInTheDocument();
    expect(screen.getByTestId('search')).toBeEmptyDOMElement();
  });

  it('shows the read-only banner only when a reason is given', () => {
    renderLayout({ readOnlyReason: 'Completed deals are locked' });
    expect(screen.getByTestId('thing-read-only')).toHaveTextContent('Completed deals are locked');
  });

  it('shows the skeleton while loading, with the breadcrumbs as the way back', () => {
    renderLayout({ loading: true });
    expect(screen.getByTestId('detail-skeleton')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('link', { name: 'Things' })).toBeInTheDocument();
    expect(screen.queryByTestId('thing-detail')).toBeNull();
    expect(screen.queryByText('Info tab')).toBeNull();
  });

  it('shows the load error instead of the record', () => {
    renderLayout({ error: new Error('boom'), errorTitle: 'Could not load the thing' });
    expect(screen.getByText('Could not load the thing')).toBeInTheDocument();
    expect(screen.queryByTestId('thing-detail')).toBeNull();
    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
  });
});
