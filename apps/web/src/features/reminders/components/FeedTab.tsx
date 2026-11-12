import { FeedKind, FeedSeverity, type FeedItem } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { readListParam, useListParams } from '../../../shared/lib/listParams';
import { formatCount } from '../../../shared/lib/money';
import { toneOf } from '../../../shared/lib/statusTones';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { fetchFeed, type FeedQuery } from '../api';
import { safeFeedLink } from '../lib/feed';
import { reminderKeys } from '../queryKeys';
import { DaysLeftTag, FeedKindIcon } from './FeedItems';

/** Horizons offered on the reminders page (days ahead); the first one is the default. */
export const FEED_HORIZONS = [30, 60, 90] as const;
const DEFAULT_HORIZON = FEED_HORIZONS[0];

function horizonParam(value: string | null): number {
  const n = Number(value);
  return (FEED_HORIZONS as readonly number[]).includes(n) ? n : DEFAULT_HORIZON;
}

/**
 * "All expiries": the reminders feed with severity chips (counts per severity), a kind
 * multi-select and the horizon (30 / 60 / 90 days), all in the URL; server paging.
 */
export function FeedTab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { page, pageSize, searchParams, setTableParams } = useListParams();

  const query = useMemo<FeedQuery>(() => {
    const kinds = readListParam(searchParams, 'kinds').filter(
      (k): k is FeedKind => FeedKind.safeParse(k).success,
    );
    const severity = readListParam(searchParams, 'severity').filter(
      (s): s is FeedSeverity => FeedSeverity.safeParse(s).success,
    );
    return {
      days: horizonParam(searchParams.get('days')),
      kinds: kinds.length > 0 ? kinds : undefined,
      severity: severity.length > 0 ? severity : undefined,
      page,
      pageSize,
    };
  }, [searchParams, page, pageSize]);
  const filtered = Boolean(query.kinds || query.severity);

  const feed = useQuery({
    queryKey: reminderKeys.feed(query),
    queryFn: ({ signal }) => fetchFeed(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = feed.data?.counts;

  const severityLabel = (s: FeedSeverity) => t(`reminders.severity.${s}`);
  const columns: DataTableColumn<FeedItem>[] = [
    {
      key: 'severity',
      title: t('reminders.fields.severity'),
      render: (item) => (
        <ToneTag tone={toneOf('FeedSeverity', item.severity)} data-severity={item.severity}>
          {severityLabel(item.severity)}
        </ToneTag>
      ),
    },
    {
      key: 'item',
      title: t('reminders.fields.item'),
      mobile: 'title',
      render: (item) => {
        const link = safeFeedLink(item.link);
        const title = <AutoDir>{item.title}</AutoDir>;
        return (
          <Flex gap={10} align="center">
            <FeedKindIcon kind={item.kind} severity={item.severity} />
            <Flex vertical>
              {link ? (
                <Link to={link} className="rm-strong-link">
                  {title}
                </Link>
              ) : (
                title
              )}
              {item.subtitle && (
                <Typography.Text type="secondary" className="rm-small-text">
                  <AutoDir>{item.subtitle}</AutoDir>
                </Typography.Text>
              )}
            </Flex>
          </Flex>
        );
      },
    },
    {
      key: 'kind',
      title: t('reminders.fields.kind'),
      render: (item) => t(`reminders.kinds.${item.kind}`),
    },
    {
      key: 'dueAt',
      title: t('reminders.fields.dueAt'),
      render: (item) => <DateText value={item.dueAt} />,
    },
    {
      key: 'daysLeft',
      title: t('reminders.fields.daysLeft'),
      render: (item) => <DaysLeftTag daysLeft={item.daysLeft} severity={item.severity} />,
    },
  ];

  const severityOptions = FeedSeverity.options.map((s) => ({
    value: s,
    label: (
      <span className="rm-chip-count">
        {severityLabel(s)}
        {counts && (
          <>
            {' '}
            <Ltr className="rm-chip-count-value">
              {formatCount(counts[s], i18n.resolvedLanguage)}
            </Ltr>
          </>
        )}
      </span>
    ),
  }));

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchKey={null}
        defaults={{ days: String(DEFAULT_HORIZON) }}
        filters={[
          {
            type: 'chips',
            key: 'severity',
            label: t('reminders.feed.severity'),
            options: severityOptions,
          },
          {
            type: 'select',
            key: 'kinds',
            label: t('reminders.feed.kinds'),
            multiple: true,
            width: 220,
            options: FeedKind.options.map((k) => ({ value: k, label: t(`reminders.kinds.${k}`) })),
          },
          {
            type: 'select',
            key: 'days',
            label: t('reminders.feed.horizon'),
            width: 180,
            options: FEED_HORIZONS.map((d) => ({
              value: String(d),
              label: t('reminders.feed.horizonDays', { days: d }),
            })),
          },
        ]}
      />
      {feed.isError ? (
        <LoadError
          error={feed.error}
          title={t('reminders.bell.loadError')}
          onRetry={() => void feed.refetch()}
        />
      ) : (
        <DataTable<FeedItem>
          label={t('reminders.feed.label')}
          data-testid="feed-table"
          rowKey={(item) => item.id}
          columns={columns}
          data={feed.data?.items}
          total={feed.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          loading={feed.isFetching}
          onChange={setTableParams}
          onRowClick={(item) => {
            const link = safeFeedLink(item.link);
            if (link) navigate(link);
          }}
          empty={
            <EmptyState
              compact
              description={filtered ? t('table.emptyFiltered') : t('reminders.feed.empty')}
            />
          }
        />
      )}
    </Flex>
  );
}
