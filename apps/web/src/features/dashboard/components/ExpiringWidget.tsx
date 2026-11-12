import { CalendarOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { fetchFeed, type FeedQuery } from '../../reminders/api';
import { FeedItemList } from '../../reminders/components/FeedItems';
import { useToggleReminderDone } from '../../reminders/hooks';
import { reminderKeys } from '../../reminders/queryKeys';
import { EXPIRING_WIDGET_SIZE, EXPIRING_WINDOW_DAYS } from '../api';

export const EXPIRING_FEED_QUERY: FeedQuery = {
  days: EXPIRING_WINDOW_DAYS,
  pageSize: EXPIRING_WIDGET_SIZE,
};

/**
 * "Expiring soon": the first items of the reminders feed (most urgent first), grouped by
 * severity, each with its kind icon, title, due date, days-left tag and a link; "View all" leads
 * to `/reminders`.
 */
export function ExpiringWidget() {
  const { t } = useTranslation();
  const toggleDone = useToggleReminderDone();
  const feed = useQuery({
    queryKey: reminderKeys.feed(EXPIRING_FEED_QUERY),
    queryFn: ({ signal }) => fetchFeed(EXPIRING_FEED_QUERY, signal),
  });

  let body;
  if (feed.isPending) body = <Skeleton active paragraph={{ rows: 4 }} title={false} />;
  else if (feed.isError)
    body = <Typography.Text type="secondary">{t('dashboard.expiringError')}</Typography.Text>;
  else if (feed.data.items.length === 0)
    body = (
      <EmptyState
        compact
        description={t('dashboard.expiringEmpty', { days: EXPIRING_WINDOW_DAYS })}
      />
    );
  else
    body = (
      <FeedItemList
        items={feed.data.items}
        grouped
        onMarkDone={(item) => toggleDone.mutate({ id: item.entityId, done: true })}
        markingId={toggleDone.isPending ? toggleDone.variables?.id : null}
        data-testid="expiring-list"
      />
    );

  return (
    <Card
      variant="borderless"
      className="rm-section-card"
      data-testid="dashboard-expiring"
      title={
        <span className="rm-section-card-title">
          <CalendarOutlined aria-hidden />
          {t('dashboard.expiringSoon')}
        </span>
      }
      extra={
        <Link to="/reminders" data-testid="expiring-view-all">
          {t('dashboard.expiringViewAll')}
        </Link>
      }
    >
      {body}
    </Card>
  );
}
