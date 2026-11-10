import { PlusOutlined } from '@ant-design/icons';
import { LeaseStatus } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel, useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { DriverPicker } from '../../drivers/components/DriverPicker';
import { fetchLeases } from '../api';
import { ContractNo } from '../components/ContractNo';
import { leasePath } from '../lib/leaseRules';
import { leaseKeys } from '../queryKeys';
import type { LeaseListItem, LeaseListQuery } from '../types';

/** `/leases`: contracts with driver, licence, car, rent, dates, status, balance and alerts. */
export function LeasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enumLabel = useEnumLabel();
  const statusOptions = useEnumOptions('LeaseStatus', LeaseStatus.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();

  const query = useMemo<LeaseListQuery>(
    () => ({
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      driverId: searchParams.get('driverId') || undefined,
      page,
      pageSize,
      sort,
      order,
    }),
    [searchParams, page, pageSize, sort, order],
  );
  const filtered = Boolean(query.q || query.status || query.driverId);

  const list = useQuery({
    queryKey: leaseKeys.list(query),
    queryFn: ({ signal }) => fetchLeases(query, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<LeaseListItem>[] = [
    {
      key: 'no',
      title: t('leases.fields.contractNo'),
      sortKey: 'contractNo',
      mobile: 'title',
      render: (l) => (
        <Link to={leasePath(l.id)} className="rm-strong-link">
          <ContractNo no={l.contractNo} />
        </Link>
      ),
    },
    {
      key: 'status',
      title: t('common.status'),
      sortKey: 'status',
      mobile: 'title',
      render: (l) => <StatusTag enumName="LeaseStatus" value={l.status} />,
    },
    {
      key: 'driver',
      title: t('leases.fields.driver'),
      render: (l) => (
        <Flex vertical>
          <Link to={`/drivers/${encodeURIComponent(l.driver.id)}`}>
            <AutoDir>{l.driver.name}</AutoDir>
          </Link>
          <Typography.Text type="secondary">{enumLabel('LeaseType', l.type)}</Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'license',
      title: t('leases.fields.license'),
      render: (l) => <LicenseTag licenseNo={l.currentSegment?.taxiLicense.licenseNo} />,
    },
    {
      key: 'vehicle',
      title: t('leases.fields.vehicle'),
      render: (l) => <PlateNo value={l.currentSegment?.vehicle?.plateNo} />,
    },
    {
      key: 'rent',
      title: t('leases.fields.monthlyRent'),
      align: 'end',
      render: (l) => <Money amount={l.currentSegment?.monthlyRent ?? null} />,
    },
    {
      key: 'period',
      title: t('leases.fields.period'),
      sortKey: 'endDate',
      render: (l) => (
        <span className="rm-nowrap">
          <DateText value={l.startDate} /> – <DateText value={l.actualEndDate ?? l.endDate} />
        </span>
      ),
    },
    {
      key: 'balance',
      title: t('ledger.fields.balance'),
      align: 'end',
      render: (l) => <BalanceText amount={l.balance?.balance ?? 0} />,
    },
    {
      key: 'alerts',
      title: t('vehicles.fields.alerts'),
      render: (l) => (
        <AlertTags enumName="LeaseAlert" alerts={l.alerts} />
      ),
    },
  ];

  const newButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/leases/new')}>
      {t('leases.new')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('leases.searchPlaceholder')}
        filters={[
          {
            type: 'select',
            key: 'status',
            label: t('common.status'),
            options: statusOptions,
            multiple: true,
            width: 180,
          },
          {
            type: 'custom',
            key: 'driverId',
            render: (value, onChange) => (
              <DriverPicker
                value={value}
                onChange={(id) => onChange(id)}
                activeOnly={false}
                aria-label={t('leases.fields.driver')}
                placeholder={t('leases.fields.driver')}
                data-testid="filter-driverId"
              />
            ),
          },
        ]}
        extra={newButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<LeaseListItem>
          label={t('nav.leases')}
          data-testid="leases-table"
          rowKey={(l) => l.id}
          columns={columns}
          data={list.data?.items}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sort={sort}
          order={order}
          loading={list.isFetching}
          onChange={setTableParams}
          onRowClick={(l) => navigate(leasePath(l.id))}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('leases.listEmpty')}
                description={t('leases.listEmptyHint')}
                action={newButton}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
