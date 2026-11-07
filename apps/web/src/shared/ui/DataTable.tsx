import type { SortOrder } from '@renawi/shared';
import { Card, Flex, Grid, Pagination, Skeleton, Table, Typography, type TableProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isolateLtr } from '../lib/bidi';
import type { TableChange } from '../lib/listParams';
import { EmptyState } from './EmptyState';

export interface DataTableColumn<T> {
  /** Stable column key (also the AntD column key). */
  key: string;
  title: ReactNode;
  render: (row: T) => ReactNode;
  /** Server-side sort field; makes the column sortable. */
  sortKey?: string;
  width?: number | string;
  align?: 'start' | 'center' | 'end';
  ellipsis?: boolean;
  /**
   * Card list below `md`: `title` = card heading, `hide` = not shown on phones, default = a
   * label/value line.
   */
  mobile?: 'title' | 'hide';
}

export interface DataTableProps<T> {
  rowKey: (row: T) => string;
  columns: DataTableColumn<T>[];
  data: readonly T[] | undefined;
  loading?: boolean;
  /** Server paging. Omit `total` for a plain (unpaged) table. */
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
  onChange?: (change: TableChange) => void;
  onRowClick?: (row: T) => void;
  /** Shown instead of the table when there are no rows. */
  empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /** Accessible name of the table. */
  label?: string;
  size?: 'small' | 'middle';
  pageSizeOptions?: number[];
  /** Footer row(s) of the desktop table (e.g. totals). */
  summary?: TableProps<T>['summary'];
  'data-testid'?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Clicks on interactive children (links, buttons, inputs) do not trigger the row action. */
function fromInteractive(event: MouseEvent | KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(target?.closest('a, button, input, label, select, textarea, [role="button"]'));
}

function toAntdOrder(column: DataTableColumn<unknown>, sort?: string, order?: SortOrder) {
  if (!column.sortKey || column.sortKey !== sort) return null;
  return order === 'asc' ? 'ascend' : 'descend';
}

/**
 * List table over AntD `Table` with server paging and sorting (state owned by the caller, usually
 * the URL via `useListParams`). Below `md` it renders the rows as a card list.
 */
export function DataTable<T extends object>({
  rowKey,
  columns,
  data,
  loading = false,
  total,
  page = 1,
  pageSize = 25,
  sort,
  order,
  onChange,
  onRowClick,
  empty,
  rowClassName,
  label,
  size = 'middle',
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  summary,
  'data-testid': testId,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const isMobile = screens.md === false;
  const rows = data ?? [];
  const paged = total !== undefined;

  const showTotal = (count: number, range: [number, number]) =>
    t('table.showTotal', {
      range: isolateLtr(`${range[0]}–${range[1]}`),
      total: count,
    });

  const emptyNode = empty ?? <EmptyState compact description={t('table.empty')} />;

  if (isMobile) {
    return (
      <div className="rm-data-cards" data-testid={testId} aria-label={label} role="list">
        {loading && rows.length === 0 ? (
          <Card variant="borderless">
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        ) : rows.length === 0 ? (
          emptyNode
        ) : (
          rows.map((row) => {
            const titleCols = columns.filter((c) => c.mobile === 'title');
            const bodyCols = columns.filter((c) => !c.mobile);
            return (
              <Card
                key={rowKey(row)}
                role="listitem"
                size="small"
                variant="borderless"
                hoverable={Boolean(onRowClick)}
                className={['rm-data-card', rowClassName?.(row)].filter(Boolean).join(' ')}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(e) => {
                  if (onRowClick && !fromInteractive(e)) onRowClick(row);
                }}
                onKeyDown={(e) => {
                  if (onRowClick && e.key === 'Enter' && !fromInteractive(e)) onRowClick(row);
                }}
              >
                {titleCols.length > 0 && (
                  <Flex gap={8} wrap align="center" className="rm-data-card-title">
                    {titleCols.map((c) => (
                      <span key={c.key}>{c.render(row)}</span>
                    ))}
                  </Flex>
                )}
                <dl className="rm-data-card-fields">
                  {bodyCols.map((c) => (
                    <div key={c.key} className="rm-data-card-field">
                      <dt>
                        <Typography.Text type="secondary">{c.title}</Typography.Text>
                      </dt>
                      <dd>{c.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            );
          })
        )}
        {paged && (total ?? 0) > 0 && (
          <Pagination
            className="rm-data-cards-pagination"
            current={page}
            pageSize={pageSize}
            total={total}
            simple
            onChange={(p, ps) => onChange?.({ page: ps !== pageSize ? 1 : p, pageSize: ps, sort, order })}
          />
        )}
      </div>
    );
  }

  const antdColumns: TableProps<T>['columns'] = columns.map((c) => ({
    key: c.key,
    title: c.title,
    width: c.width,
    align: c.align,
    ellipsis: c.ellipsis,
    sorter: c.sortKey ? true : undefined,
    sortOrder: c.sortKey ? toAntdOrder(c as DataTableColumn<unknown>, sort, order) : undefined,
    sortDirections: c.sortKey ? ['ascend', 'descend', 'ascend'] : undefined,
    render: (_: unknown, row: T) => c.render(row),
  }));

  return (
    <Table<T>
      className="rm-data-table"
      data-testid={testId}
      aria-label={label}
      rowKey={rowKey}
      columns={antdColumns}
      dataSource={rows as T[]}
      loading={loading}
      size={size}
      sticky={{ offsetHeader: 64 }}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: loading ? ' ' : emptyNode }}
      summary={summary}
      rowClassName={(row) =>
        [onRowClick ? 'rm-row-clickable' : undefined, rowClassName?.(row)]
          .filter(Boolean)
          .join(' ')
      }
      onRow={
        onRowClick
          ? (row) => ({
              tabIndex: 0,
              onClick: (e) => {
                if (!fromInteractive(e)) onRowClick(row);
              },
              onKeyDown: (e) => {
                if (e.key === 'Enter' && !fromInteractive(e)) onRowClick(row);
              },
            })
          : undefined
      }
      pagination={
        paged
          ? {
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions,
              showTotal,
              hideOnSinglePage: false,
            }
          : false
      }
      onChange={(pagination, _filters, sorter, extra) => {
        if (!onChange) return;
        const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<T> | undefined;
        const column = columns.find((c) => c.key === s?.columnKey);
        const nextSort = s?.order && column?.sortKey ? column.sortKey : undefined;
        const nextOrder: SortOrder | undefined = s?.order
          ? s.order === 'ascend'
            ? 'asc'
            : 'desc'
          : undefined;
        const nextPageSize = pagination.pageSize ?? pageSize;
        const resetPage = extra.action === 'sort' || nextPageSize !== pageSize;
        onChange({
          page: resetPage ? 1 : (pagination.current ?? 1),
          pageSize: nextPageSize,
          sort: nextSort,
          order: nextSort ? nextOrder : undefined,
        });
      }}
    />
  );
}
