import { LockOutlined } from '@ant-design/icons';
import { Alert, Flex, Tabs, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ActionBar, type ActionBarProps } from './ActionBar';
import { DetailSkeleton } from './DetailSkeleton';
import { LoadError } from './LoadError';
import { PageBreadcrumbs, type BreadcrumbEntry } from './PageBreadcrumbs';

export interface DetailTab {
  key: string;
  label: ReactNode;
  children: ReactNode;
}

export interface DetailPageLayoutProps<K extends string = string> {
  /** After "Home": the section list, then the record. */
  breadcrumbs: readonly BreadcrumbEntry[];
  /** The record (`<h2>`; the page title in the top bar is the `<h1>`). */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Status / type / alert tags at the end of the title row. */
  tags?: ReactNode;
  /** Header actions, always through `ActionBar` (buttons from `md` up, a menu on phones). */
  actions?: ActionBarProps<K> | null;
  /** Lifecycle stepper (later phase). */
  lifecycle?: ReactNode;
  /** Key facts under the title (`FactChips`). */
  facts?: ReactNode;
  /** Why the record cannot be edited; only where the page already disables editing. */
  readOnlyReason?: ReactNode;
  /** Banners or an inline edit form between the header and the tabs. */
  children?: ReactNode;
  /** Tabs synced with `?tab=` (the first one is the default and has no param). */
  tabs?: readonly DetailTab[] | null;
  loading?: boolean;
  /** A failed query: shown with `LoadError` (404 as "not found"). */
  error?: unknown;
  errorTitle?: ReactNode;
  notFoundTitle?: ReactNode;
  onRetry?: () => void;
  /** Test ids: `<id>-detail` on the page, `<id>-tags`, `<id>-facts`. */
  testId: string;
}

/**
 * The frame of every record page: breadcrumbs, title row with tags and actions, read-only
 * banner, lifecycle, key facts, then the content in tabs. Loading and error states keep the
 * breadcrumbs so the way back is always there.
 */
export function DetailPageLayout<K extends string = string>({
  breadcrumbs,
  title,
  subtitle,
  tags,
  actions,
  lifecycle,
  facts,
  readOnlyReason,
  children,
  tabs,
  loading = false,
  error,
  errorTitle,
  notFoundTitle,
  onRetry,
  testId,
}: DetailPageLayoutProps<K>) {
  if (loading) {
    return (
      <Flex vertical gap={16} className="rm-detail-page">
        <PageBreadcrumbs items={breadcrumbs} />
        <DetailSkeleton />
      </Flex>
    );
  }
  if (error) {
    return (
      <Flex vertical gap={16} className="rm-detail-page">
        <PageBreadcrumbs items={breadcrumbs} />
        <LoadError
          error={error}
          title={errorTitle}
          notFoundTitle={notFoundTitle}
          onRetry={onRetry}
        />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={16} className="rm-detail-page" data-testid={`${testId}-detail`}>
      <PageBreadcrumbs items={breadcrumbs} />
      <Flex className="rm-detail-header" justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={4} className="rm-detail-heading">
          <Flex gap={12} align="center" wrap className="rm-detail-title-row">
            {title && (
              <Typography.Title level={2} className="rm-detail-title">
                {title}
              </Typography.Title>
            )}
            {tags && (
              <Flex gap={6} wrap align="center" className="rm-detail-tags" data-testid={`${testId}-tags`}>
                {tags}
              </Flex>
            )}
          </Flex>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </Flex>
        {actions && actions.actions.length > 0 && (
          <Flex gap={8} wrap align="center" className="rm-detail-actions">
            <ActionBar {...actions} />
          </Flex>
        )}
      </Flex>
      {readOnlyReason && (
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined />}
          title={readOnlyReason}
          data-testid={`${testId}-read-only`}
        />
      )}
      {lifecycle}
      {facts && <div data-testid={`${testId}-facts`}>{facts}</div>}
      {children}
      {tabs && tabs.length > 0 && <DetailTabs items={tabs} />}
    </Flex>
  );
}

/**
 * Tabs whose active key lives in `?tab=`. Switching starts from a clean URL (each tab keeps its
 * own filters in the URL); hidden tabs unmount so their queries stop.
 */
function DetailTabs({ items }: { items: readonly DetailTab[] }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const defaultKey = items[0]?.key ?? '';
  const active = items.some((item) => item.key === raw) ? (raw as string) : defaultKey;
  return (
    <Tabs
      className="rm-detail-tabs"
      // Tabs that do not fit (phones) go to the overflow menu; it opens on tap, not hover.
      more={{ trigger: ['click'] }}
      activeKey={active}
      onChange={(key) => setParams(key === defaultKey ? {} : { tab: key }, { replace: true })}
      destroyOnHidden
      items={items.map((item) => ({ ...item }))}
    />
  );
}
