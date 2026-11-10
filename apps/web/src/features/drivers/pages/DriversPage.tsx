import { PlusOutlined } from '@ant-design/icons';
import { DriverStatus } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { fetchDrivers } from '../api';
import { driverPath } from '../lib/driverRules';
import { driverKeys } from '../queryKeys';
import type { DriverListItem, DriverListQuery } from '../types';

/** `/drivers`: drivers with their active contract, balance, deposit and permit alerts. */
export function DriversPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusOptions = useEnumOptions('DriverStatus', DriverStatus.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();

  const query = useMemo<DriverListQuery>(
    () => ({
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      withBalanceOnly: searchParams.get('balance') === '1' || undefined,
      page,
      pageSize,
      sort,
      order,
    }),
    [searchParams, page, pageSize, sort, order],
  );
  const filtered = Boolean(query.q || query.status || query.withBalanceOnly);

  const list = useQuery({
    queryKey: driverKeys.list(query),
    queryFn: ({ signal }) => fetchDrivers(query, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<DriverListItem>[] = [
    {
      key: 'name',
      title: t('drivers.fields.name'),
      sortKey: 'name',
      mobile: 'title',
      render: (d) => (
        <Flex vertical>
          <Link to={driverPath(d.id)} className="rm-strong-link">
            <AutoDir>{d.name || '—'}</AutoDir>
          </Link>
          {d.contact?.idNumber && (
            <Typography.Text type="secondary">
              <Ltr>{d.contact.idNumber}</Ltr>
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'phone',
      title: t('common.phone'),
      render: (d) => <PhoneText value={d.contact?.phones?.[0]} />,
    },
    {
      key: 'status',
      title: t('common.status'),
      sortKey: 'status',
      render: (d) => <StatusTag enumName="DriverStatus" value={d.status} />,
    },
    {
      key: 'contract',
      title: t('drivers.fields.activeContract'),
      render: (d) =>
        d.activeContract ? (
          <Flex gap={6} wrap align="center">
            <LicenseTag licenseNo={d.activeContract.licenseNo} />
            {d.activeContract.plateNo && <PlateNo value={d.activeContract.plateNo} />}
          </Flex>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'balance',
      title: t('ledger.fields.balance'),
      sortKey: 'balance',
      align: 'end',
      render: (d) => <BalanceText amount={d.balance?.balance ?? 0} />,
    },
    {
      key: 'deposit',
      title: t('ledger.fields.depositHeld'),
      align: 'end',
      render: (d) => <Money amount={d.balance?.depositHeld ?? 0} />,
    },
    {
      key: 'alerts',
      title: t('vehicles.fields.alerts'),
      render: (d) => (
        <AlertTags enumName="DriverAlert" alerts={d.alerts} />
      ),
    },
  ];

  const newButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/drivers/new')}>
      {t('drivers.new')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('drivers.searchPlaceholder')}
        filters={[
          {
            type: 'select',
            key: 'status',
            label: t('common.status'),
            options: statusOptions,
            multiple: true,
            width: 180,
          },
          { type: 'toggle', key: 'balance', label: t('drivers.withBalanceOnly') },
        ]}
        extra={newButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<DriverListItem>
          label={t('nav.drivers')}
          data-testid="drivers-table"
          rowKey={(d) => d.id}
          columns={columns}
          data={list.data?.items}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sort={sort}
          order={order}
          loading={list.isFetching}
          onChange={setTableParams}
          onRowClick={(d) => navigate(driverPath(d.id))}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('drivers.listEmpty')}
                description={t('drivers.listEmptyHint')}
                action={newButton}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
