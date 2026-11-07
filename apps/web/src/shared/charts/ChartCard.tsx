import { BarChartOutlined, TableOutlined } from '@ant-design/icons';
import { Card, Flex, Segmented, Skeleton, Typography } from 'antd';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../ui/EmptyState';

export interface LegendItem {
  key: string;
  label: ReactNode;
  color: string;
  /** Mirrors the mark: a rect for bars / areas / segments, a line for lines. */
  shape?: 'rect' | 'line';
}

/** Legend in text ink; identity comes from the swatch beside each name, never coloured text. */
export function ChartLegend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className="rm-chart-legend" data-testid="chart-legend">
      {items.map((item) => (
        <li key={item.key} className="rm-chart-legend-item">
          <span
            aria-hidden
            className={
              item.shape === 'line' ? 'rm-chart-swatch rm-chart-swatch-line' : 'rm-chart-swatch'
            }
            style={{ background: item.color }}
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface ChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Legend (omit for a single series: the title names it). */
  legend?: readonly LegendItem[];
  /** The chart. */
  children: ReactNode;
  /** The table-view twin of the chart (the accessible equivalent). */
  table: ReactNode;
  /** First load: a skeleton. */
  loading?: boolean;
  /** Refetch: keep the previous render at reduced opacity (no skeleton flash). */
  fetching?: boolean;
  /** No data to draw. */
  empty?: boolean;
  emptyText?: ReactNode;
  /** Shown instead of the body (e.g. a load error with retry). */
  error?: ReactNode;
  /** Trailing header content (a "view report" link). */
  extra?: ReactNode;
  'data-testid'?: string;
}

/**
 * Chart container: title, optional legend, the chart, and a chart / table toggle so every value
 * is reachable without hovering. The card grows with its content (no fixed height that could
 * clip the axis band).
 */
export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  table,
  loading = false,
  fetching = false,
  empty = false,
  emptyText,
  error,
  extra,
  'data-testid': testId,
}: ChartCardProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const titleId = useId();

  const toggle = (
    <Segmented<'chart' | 'table'>
      size="small"
      value={view}
      onChange={setView}
      options={[
        {
          value: 'chart',
          icon: <BarChartOutlined />,
          label: <span className="rm-visually-hidden">{t('charts.showChart')}</span>,
          title: t('charts.showChart'),
        },
        {
          value: 'table',
          icon: <TableOutlined />,
          label: <span className="rm-visually-hidden">{t('charts.showTable')}</span>,
          title: t('charts.showTable'),
        },
      ]}
      data-testid="chart-view-toggle"
    />
  );

  let body: ReactNode;
  if (error) body = error;
  else if (loading) body = <Skeleton active paragraph={{ rows: 5 }} />;
  else if (empty) body = <EmptyState compact description={emptyText ?? t('charts.noData')} />;
  else body = view === 'chart' ? children : table;

  return (
    <Card
      variant="borderless"
      className="rm-chart-card"
      data-testid={testId}
      title={
        <div className="rm-chart-card-heading">
          <span id={titleId}>{title}</span>
          {subtitle && (
            <Typography.Text type="secondary" className="rm-chart-card-subtitle">
              {subtitle}
            </Typography.Text>
          )}
        </div>
      }
      extra={
        <Flex gap={8} align="center">
          {extra}
          {!error && !loading && !empty && toggle}
        </Flex>
      }
    >
      <figure
        className={fetching ? 'rm-chart-figure rm-chart-refetching' : 'rm-chart-figure'}
        aria-labelledby={titleId}
        aria-busy={fetching || loading || undefined}
      >
        {legend && legend.length > 1 && view === 'chart' && !empty && !loading && !error && (
          <ChartLegend items={legend} />
        )}
        {body}
      </figure>
    </Card>
  );
}
