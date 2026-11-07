import { Flex, Tag, Typography } from 'antd';
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
import type { TrafficFine } from '../types';
import { FINE_ALERT_COLORS } from './fineRules';

export interface FinesTableProps {
  data: readonly TrafficFine[] | undefined;
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onChange?: (change: TableChange) => void;
  onOpen: (fine: TrafficFine) => void;
  /** Hide the plate column (vehicle page). */
  hideVehicle?: boolean;
  empty?: ReactNode;
}

/** Fines: plate, offence, received, amount, matched driver, status, reassignment deadline. */
export function FinesTable({
  data,
  loading,
  total,
  page,
  pageSize,
  onChange,
  onOpen,
  hideVehicle,
  empty,
}: FinesTableProps) {
  const { t } = useTranslation();
  const columns: DataTableColumn<TrafficFine>[] = [
    ...(hideVehicle
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
      mobile: 'title',
      render: (f) => <DateTimeText value={f.offenceAt} />,
    },
    {
      key: 'received',
      title: t('fines.fields.receivedAt'),
      render: (f) => <DateText value={f.receivedAt} />,
    },
    {
      key: 'amount',
      title: t('fines.fields.amount'),
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
      render: (f) => (
        <Flex gap={4} wrap>
          <StatusTag enumName="FineStatus" value={f.status} />
          {f.chargeEntryId && <Tag color="success">{t('fines.rebilledTag')}</Tag>}
        </Flex>
      ),
    },
    {
      key: 'deadline',
      title: t('fines.fields.reassignDeadline'),
      render: (f) => (
        <Flex gap={6} wrap align="center">
          <DateText value={f.reassignDeadline} />
          <AlertTags alerts={f.alerts} group="fines.alerts" colors={FINE_ALERT_COLORS} hideEmpty />
        </Flex>
      ),
    },
  ];
  return (
    <DataTable<TrafficFine>
      label={t('nav.fines')}
      data-testid="fines-table"
      rowKey={(f) => f.id}
      columns={columns}
      data={data}
      loading={loading}
      total={total}
      page={page}
      pageSize={pageSize}
      onChange={onChange}
      onRowClick={onOpen}
      empty={empty}
    />
  );
}
