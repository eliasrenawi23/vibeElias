import { DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import type { ActivityItem, AuditAction } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { Card, Skeleton, Typography } from 'antd';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useDynamicT } from '../../../shared/lib/i18n';
import { toneClassName, type Tone } from '../../../shared/lib/statusTones';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { safeFeedLink } from '../../reminders/lib/feed';
import { ACTIVITY_LIMIT, fetchActivity } from '../api';
import { dashboardKeys } from '../queryKeys';

const ACTION_ICONS: Readonly<Record<AuditAction, ComponentType>> = {
  CREATE: PlusOutlined,
  UPDATE: EditOutlined,
  DELETE: DeleteOutlined,
};
const ACTION_TONES: Readonly<Record<AuditAction, Tone>> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'neutral',
};

/**
 * Recent changes (the audit log): what happened to which record, by whom and when, built from
 * translated parts (the API's `summary` is English and is not shown).
 */
export function ActivityList() {
  const { t, i18n } = useTranslation();
  const enumLabel = useEnumLabel();
  const dynamicT = useDynamicT();
  const activity = useQuery({
    queryKey: dashboardKeys.activity(ACTIVITY_LIMIT),
    queryFn: ({ signal }) => fetchActivity(ACTIVITY_LIMIT, signal),
  });

  const row = (item: ActivityItem) => {
    const Icon = ACTION_ICONS[item.action] ?? EditOutlined;
    // Unknown entities (a newer API) show their model name.
    const entityKey = `dashboard.activity.entities.${item.entity}`;
    const entity = i18n.exists(entityKey) ? dynamicT(entityKey) : item.entity;
    const link = safeFeedLink(item.link);
    const name = item.label ? <AutoDir>{item.label}</AutoDir> : null;
    return (
      <li key={item.id} className="rm-activity-item" data-testid="activity-item">
        <span aria-hidden className={`rm-feed-icon ${toneClassName(ACTION_TONES[item.action])}`}>
          <Icon />
        </span>
        <div className="rm-feed-body">
          <div className="rm-feed-title">
            <span className="rm-activity-action">{enumLabel('AuditAction', item.action)}</span>{' '}
            <span>{entity}</span>
            {name && (
              <>
                {' '}
                {link && item.action !== 'DELETE' ? <Link to={link}>{name}</Link> : name}
              </>
            )}
          </div>
          <Typography.Text type="secondary" className="rm-feed-meta">
            {item.userName ? <AutoDir>{item.userName}</AutoDir> : t('dashboard.activity.system')}
            {' · '}
            <DateTimeText value={item.at} />
            {item.action === 'UPDATE' && item.changes.length > 0 && (
              <>
                {' · '}
                {t('dashboard.activity.fieldsChanged', { count: item.changes.length })}
              </>
            )}
          </Typography.Text>
        </div>
      </li>
    );
  };

  let body;
  if (activity.isPending) body = <Skeleton active paragraph={{ rows: 4 }} title={false} />;
  else if (activity.isError)
    body = <Typography.Text type="secondary">{t('dashboard.activity.error')}</Typography.Text>;
  else if (activity.data.length === 0)
    body = <EmptyState compact description={t('dashboard.activity.empty')} />;
  else body = <ul className="rm-feed-list">{activity.data.map(row)}</ul>;

  return (
    <Card
      variant="borderless"
      className="rm-section-card"
      data-testid="dashboard-activity"
      title={
        <span className="rm-section-card-title">
          <HistoryOutlined aria-hidden />
          {t('dashboard.activity.title')}
        </span>
      }
    >
      {body}
    </Card>
  );
}
