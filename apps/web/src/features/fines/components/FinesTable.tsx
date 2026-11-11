import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import type { TableChange } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import type { TrafficFine } from '../types';

/** Columns that a context can leave out (the plate on the vehicle's own file). */
export type FineColumnKey = 'vehicle';

export interface FinesTableProps {
  data: readonly TrafficFine[] | undefined;
  loading: boolean;
  empty: ReactNode;
  /** Open the fine (drawer). */
  onOpen: (fine: TrafficFine) => void;
  hide?: readonly FineColumnKey[];
  /** Server paging / sorting (the fines list); omit for a plain table. */
  paging?: {
    total: number;
    page: number;
    pageSize: number;
    sort?: string;
    order?: 'asc' | 'desc';
    onChange: (change: TableChange) => void;
  };
  label?: string;
  'data-testid'?: string;
}

/**
 * Fines as a table: plate, offence, received, amount, matched driver, status, reassignment
 * deadline (with its alert). Same shape as `DealsTable`.
 */
export function FinesTable({
  data,
  loading,
  empty,
  onOpen,
  hide = [],
  paging,
  label,
  'data-testid': testId = 'fines-table',
}: FinesTableProps) {
  const { t } = useTranslation();
  const columns: DataTableColumn<TrafficFine>[] = [
    ...(hide.includes('vehicle')
      ? []
      : [
          {
            key: 'plate',
            title: t('fines.fields.vehicle'),
            mobile: 'title' as const,
            render: (f: TrafficFine) => <PlateNo value={f.vehicle?.plateNo} />,
          },
        ]),
    {
      key: 'offence',
      title: t('fines.fields.offenceAt'),
      sortKey: 'offenceAt',
      mobile: 'title',
      render: (f) => <DateTimeText value={f.offenceAt} />,
    },
    {
      key: 'received',
      title: t('fines.fields.receivedAt'),
      sortKey: 'receivedAt',
      render: (f) => <DateText value={f.receivedAt} />,
    },
    {
      key: 'amount',
      title: t('fines.fields.amount'),
      sortKey: 'amount',
      align: 'end',
      render: (f) => <Money amount={f.amount} />,
    },
    {
      key: 'driver',
      title: t('fines.fields.driver'),
      render: (f) =>
        f.driver ? (
          <Link to={`/drivers/${encodeURIComponent(f.driver.id)}`}>
            <AutoDir>{f.driver.name}</AutoDir>
          </Link>
        ) : (
          <Typography.Text type="warning">{t('fines.noDriver')}</Typography.Text>
        ),
    },
    {
      key: 'status',
      title: t('common.status'),
      sortKey: 'status',
      render: (f) => (
        <Flex gap={4} wrap>
          <StatusTag enumName="FineStatus" value={f.status} />
          {f.chargeEntryId && <ToneTag tone="success">{t('fines.rebilledTag')}</ToneTag>}
        </Flex>
      ),
    },
    {
      key: 'deadline',
      title: t('fines.fields.reassignDeadline'),
      sortKey: 'reassignDeadline',
      render: (f) => (
        <Flex gap={6} wrap align="center">
          <DateText value={f.reassignDeadline} />
          <AlertTags enumName="FineAlert" alerts={f.alerts} hideEmpty />
        </Flex>
      ),
    },
  ];
  return (
    <DataTable<TrafficFine>
      label={label ?? t('nav.fines')}
      data-testid={testId}
      rowKey={(f) => f.id}
      columns={columns}
      data={data}
      loading={loading}
      total={paging?.total}
      page={paging?.page}
      pageSize={paging?.pageSize}
      sort={paging?.sort}
      order={paging?.order}
      onChange={paging?.onChange}
      onRowClick={onOpen}
      empty={empty}
    />
  );
}
