import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import type { TableChange } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ContactLink } from '../../contacts/components/ContactLink';
import { dealPath, hasTransfer } from '../lib/dealRules';
import type { DealListItem } from '../types';
import { DealNo, DealTypeTag, DealVehicleCell, TransferCell } from './DealBits';

/** Columns that a context can leave out (the vehicle on its own file, the contact on its page). */
export type DealColumnKey = 'vehicle' | 'counterparty';

export interface DealsTableProps {
  data: readonly DealListItem[] | undefined;
  loading: boolean;
  empty: ReactNode;
  hide?: readonly DealColumnKey[];
  /** Server paging / sorting (the deals list); omit for a plain table. */
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
 * Deals as a table: number, type, date, car, counterparty, price, paid / due, status, transfer
 * (with its due-date badge) and alerts.
 */
export function DealsTable({
  data,
  loading,
  empty,
  hide = [],
  paging,
  label,
  'data-testid': testId = 'deals-table',
}: DealsTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const columns: DataTableColumn<DealListItem>[] = [
    {
      key: 'no',
      title: t('deals.fields.dealNo'),
      sortKey: 'dealNo',
      mobile: 'title',
      render: (d) => (
        <Link to={dealPath(d.id)} className="rm-strong-link">
          <DealNo no={d.dealNo} />
        </Link>
      ),
    },
    {
      key: 'type',
      title: t('deals.fields.type'),
      mobile: 'title',
      render: (d) => <DealTypeTag type={d.type} />,
    },
    {
      key: 'date',
      title: t('deals.fields.date'),
      sortKey: 'date',
      render: (d) => <DateText value={d.date} />,
    },
    ...(hide.includes('vehicle')
      ? []
      : [
          {
            key: 'vehicle',
            title: t('deals.fields.vehicle'),
            render: (d: DealListItem) => <DealVehicleCell vehicle={d.vehicle} />,
          },
        ]),
    ...(hide.includes('counterparty')
      ? []
      : [
          {
            key: 'counterparty',
            title: t('deals.fields.counterparty'),
            render: (d: DealListItem) => (
              <ContactLink
                id={d.counterparty?.id ?? d.counterpartyId}
                name={d.counterparty?.name}
              />
            ),
          },
        ]),
    {
      key: 'price',
      title: t('deals.fields.price'),
      sortKey: 'price',
      align: 'end',
      render: (d) => <Money amount={d.price} />,
    },
    {
      key: 'paid',
      title: t('deals.fields.paidDue'),
      align: 'end',
      render: (d) => <PaidDue deal={d} />,
    },
    {
      key: 'status',
      title: t('common.status'),
      sortKey: 'status',
      render: (d) => <StatusTag enumName="DealStatus" value={d.status} />,
    },
    {
      key: 'transfer',
      title: t('deals.fields.transfer'),
      render: (d) =>
        hasTransfer(d) ? (
          <TransferCell
            status={d.transferStatus}
            dueAt={d.transferDueAt}
            transferredAt={d.transferredAt}
          />
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'alerts',
      title: t('vehicles.fields.alerts'),
      render: (d) => (
        <AlertTags enumName="DealAlert" alerts={d.alerts} />
      ),
    },
  ];

  return (
    <DataTable<DealListItem>
      label={label ?? t('nav.deals')}
      data-testid={testId}
      rowKey={(d) => d.id}
      columns={columns}
      data={data}
      loading={loading}
      total={paging?.total}
      page={paging?.page}
      pageSize={paging?.pageSize}
      sort={paging?.sort}
      order={paging?.order}
      onChange={paging?.onChange}
      onRowClick={(d) => navigate(dealPath(d.id))}
      empty={empty}
    />
  );
}

/** Paid so far and what is still due (or "settled"). */
function PaidDue({ deal }: { deal: DealListItem }) {
  const { t } = useTranslation();
  const paid = deal.type === 'PURCHASE' ? deal.paidOut : deal.paidIn;
  const due = deal.balanceDue;
  return (
    <Flex vertical align="flex-end" gap={0} className="rm-paid-due">
      <Money amount={paid} />
      {due > 0.004 ? (
        <Typography.Text type="danger" className="rm-small-text">
          {t('deals.fields.due')} <Money amount={due} />
        </Typography.Text>
      ) : deal.status === 'COMPLETED' ? (
        <Typography.Text type="success" className="rm-small-text">
          {t('deals.settled')}
        </Typography.Text>
      ) : null}
    </Flex>
  );
}
