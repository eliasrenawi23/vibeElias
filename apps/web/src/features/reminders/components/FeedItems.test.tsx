import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../app/i18n';
import { jsonResponse, renderWithProviders } from '../../../test/renderWithProviders';
import { feedItem } from '../../../test/fixtures';
import { FeedItemList } from './FeedItems';
import { RemindersBell } from './RemindersBell';

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const ITEMS = [
  feedItem({
    id: 'o1',
    severity: 'overdue',
    daysLeft: -4,
    title: 'Overdue car',
    dueAt: '2026-11-08',
  }),
  feedItem({
    id: 'd1',
    kind: 'insurance',
    entityType: 'insurance',
    severity: 'due',
    daysLeft: 0,
    title: 'Due policy',
    subtitle: 'Harel 778',
  }),
  feedItem({
    id: 'reminder:manual:rem_1',
    kind: 'manual',
    entityType: 'reminder',
    entityId: 'rem_1',
    severity: 'upcoming',
    daysLeft: 1,
    title: 'Call the garage',
    link: '/reminders',
  }),
];

describe('FeedItemList', () => {
  it('groups by severity with the tone, kind, title link and days left', () => {
    const onMarkDone = vi.fn();
    renderWithProviders(
      <MemoryRouter>
        <FeedItemList items={ITEMS} grouped onMarkDone={onMarkDone} />
      </MemoryRouter>,
    );
    const groups = screen.getAllByRole('region');
    expect(groups.map((g) => g.getAttribute('data-severity'))).toEqual([
      'overdue',
      'due',
      'upcoming',
    ]);
    expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual([
      'Overdue',
      'Due soon',
      'Upcoming',
    ]);

    const overdue = within(groups[0]!).getByTestId('feed-item');
    expect(within(overdue).getByRole('link', { name: 'Overdue car' })).toHaveAttribute(
      'href',
      '/vehicles/veh_1',
    );
    expect(overdue).toHaveTextContent('Vehicle licence (test)');
    const overdueTag = overdue.querySelector('[data-severity="overdue"]');
    expect(overdueTag).toHaveTextContent(/4⁩? days overdue/);
    expect(overdueTag).toHaveAttribute('data-tone', 'error');
    expect(overdue.querySelector('.rm-feed-icon')).toHaveClass('rm-tone-error');

    const due = within(groups[1]!).getByTestId('feed-item');
    expect(due).toHaveTextContent('Insurance · Harel 778');
    expect(due.querySelector('[data-severity="due"]')).toHaveTextContent('Due today');
    expect(due.querySelector('[data-severity="due"]')).toHaveAttribute('data-tone', 'warning');

    // Only the manual reminder offers "mark done".
    expect(screen.getAllByTestId('feed-mark-done')).toHaveLength(1);
    const upcoming = within(groups[2]!).getByTestId('feed-item');
    expect(upcoming.querySelector('[data-severity="upcoming"]')).toHaveTextContent('Tomorrow');
    fireEvent.click(within(upcoming).getByTestId('feed-mark-done'));
    expect(onMarkDone).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'rem_1' }));
  });
});

describe('RemindersBell', () => {
  it('badges overdue + due and polls the overdue and due items', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      jsonResponse({
        items: ITEMS.slice(0, 2),
        total: 5,
        page: 1,
        pageSize: 10,
        counts: { overdue: 2, due: 3, upcoming: 7 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(
      <MemoryRouter>
        <RemindersBell />
      </MemoryRouter>,
    );
    const bell = screen.getByTestId('reminders-bell');
    await waitFor(() => expect(bell).toHaveAttribute('data-count', '5'));
    expect(bell).toHaveAccessibleName('Reminders: 5 need attention');
    expect(bell.querySelector('.ant-badge')).toHaveTextContent('5');
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/reminders/feed');
    expect(url.searchParams.get('severity')).toBe('overdue,due');
    expect(url.searchParams.get('days')).toBe('30');

    fireEvent.click(bell);
    const panel = await screen.findByTestId('bell-panel');
    expect(within(panel).getAllByTestId('feed-item')).toHaveLength(2);
    expect(within(panel).getByTestId('bell-see-all')).toHaveAttribute('href', '/reminders');
  });

  it('shows no badge when nothing needs attention', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          items: [],
          total: 0,
          page: 1,
          pageSize: 10,
          counts: { overdue: 0, due: 0, upcoming: 4 },
        }),
      ),
    );
    renderWithProviders(
      <MemoryRouter>
        <RemindersBell />
      </MemoryRouter>,
    );
    const bell = screen.getByTestId('reminders-bell');
    await waitFor(() => expect(bell).toHaveAttribute('data-count', '0'));
    expect(bell).toHaveAccessibleName('Reminders');
    expect(bell.querySelector('.ant-badge-count')).toBeNull();
  });
});
