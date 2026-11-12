import { BellOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Drawer, Flex, Grid, Popover, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { fetchFeed, type FeedQuery } from '../api';
import { useToggleReminderDone } from '../hooks';
import { attentionCount } from '../lib/feed';
import { reminderKeys } from '../queryKeys';
import { FeedItemList } from './FeedItems';

/** The bell polls the feed this often (and refetches when the window regains focus). */
export const BELL_POLL_MS = 5 * 60 * 1000;

/** What the bell lists: the overdue and due items of the next 30 days, most urgent first. */
export const BELL_FEED_QUERY: FeedQuery = { days: 30, severity: ['overdue', 'due'], pageSize: 10 };

/**
 * Reminders bell in the top bar: the badge counts overdue + due items of the reminders feed;
 * the list opens in a popover on desktop and a drawer on phones, with a link per record, "mark
 * done" on manual reminders and "See all" to `/reminders`.
 */
export function RemindersBell() {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const isMobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const toggleDone = useToggleReminderDone();

  const feed = useQuery({
    queryKey: reminderKeys.feed(BELL_FEED_QUERY),
    queryFn: ({ signal }) => fetchFeed(BELL_FEED_QUERY, signal),
    refetchInterval: BELL_POLL_MS,
    refetchOnWindowFocus: true,
  });
  const count = attentionCount(feed.data?.counts);
  const label = count > 0 ? t('reminders.bell.badge', { count }) : t('reminders.bell.label');

  const close = () => setOpen(false);
  let body;
  if (feed.isPending) body = <Skeleton active paragraph={{ rows: 3 }} title={false} />;
  else if (feed.isError)
    body = <Typography.Text type="secondary">{t('reminders.bell.loadError')}</Typography.Text>;
  else if (feed.data.items.length === 0)
    body = <EmptyState compact description={t('reminders.bell.empty')} />;
  else
    body = (
      <FeedItemList
        items={feed.data.items}
        grouped
        onNavigate={close}
        onMarkDone={(item) => toggleDone.mutate({ id: item.entityId, done: true })}
        markingId={toggleDone.isPending ? toggleDone.variables?.id : null}
        data-testid="bell-list"
      />
    );

  const content = (
    <Flex vertical gap={12} className="rm-bell-panel" data-testid="bell-panel">
      {body}
      <Link to="/reminders" onClick={close} className="rm-bell-see-all" data-testid="bell-see-all">
        {t('reminders.bell.seeAll')}
      </Link>
    </Flex>
  );

  const trigger = (
    <Button
      type="text"
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={isMobile ? () => setOpen(true) : undefined}
      data-testid="reminders-bell"
      data-count={count}
      icon={
        <Badge count={count} size="small" overflowCount={99} className="rm-bell-badge">
          <BellOutlined className="rm-bell-icon" />
        </Badge>
      }
    />
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          open={open}
          onClose={close}
          title={t('reminders.bell.title')}
          placement="bottom"
          size={520}
          destroyOnHidden
          data-testid="bell-drawer"
        >
          {content}
        </Drawer>
      </>
    );
  }
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      title={t('reminders.bell.title')}
      content={content}
      classNames={{ root: 'rm-bell-popover' }}
      destroyOnHidden
    >
      {trigger}
    </Popover>
  );
}
