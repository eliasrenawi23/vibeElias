import { PlusOutlined } from '@ant-design/icons';
import { TaxiLicenseStatus } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Flex } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { fetchTaxiLicenses } from '../api';
import { AnnualFeeText } from '../components/AnnualFeeText';
import { licensePath } from '../lib/licenseRules';
import { taxiLicenseKeys } from '../queryKeys';
import type { TaxiLicenseListItem, TaxiLicenseListQuery } from '../types';

/** `/taxi-licenses`: every licence with its current driver and car, rent, fee date and alerts. */
export function TaxiLicensesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const statusOptions = useEnumOptions('TaxiLicenseStatus', TaxiLicenseStatus.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();

  const query = useMemo<TaxiLicenseListQuery>(
    () => ({
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      page,
      pageSize,
      sort,
      order,
    }),
    [searchParams, page, pageSize, sort, order],
  );
  const filtered = Boolean(query.q || query.status);

  const list = useQuery({
    queryKey: taxiLicenseKeys.list(query),
    queryFn: ({ signal }) => fetchTaxiLicenses(query, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<TaxiLicenseListItem>[] = [
    {
      key: 'licenseNo',
      title: t('taxiLicenses.fields.licenseNo'),
      sortKey: 'licenseNo',
      mobile: 'title',
      render: (l) => <LicenseTag licenseNo={l.licenseNo} id={l.id} />,
    },
    {
      key: 'status',
      title: t('common.status'),
      sortKey: 'status',
      mobile: 'title',
      render: (l) => <StatusTag enumName="TaxiLicenseStatus" value={l.status} />,
    },
    {
      key: 'holder',
      title: t('taxiLicenses.fields.holderName'),
      render: (l) =>
        l.holderName ? (
          <AutoDir>{l.holderName}</AutoDir>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'driver',
      title: t('taxiLicenses.currentDriver'),
      render: (l) =>
        l.currentSegment ? (
          <Link to={`/drivers/${encodeURIComponent(l.currentSegment.driver.id)}`}>
            <AutoDir>{l.currentSegment.driver.name}</AutoDir>
          </Link>
        ) : (
          <span className="rm-empty-value">{t('taxiLicenses.unassigned')}</span>
        ),
    },
    {
      key: 'vehicle',
      title: t('taxiLicenses.currentVehicle'),
      render: (l) => {
        const plate = l.currentSegment?.vehicle?.plateNo ?? l.registeredVehicle?.plateNo;
        return <PlateNo value={plate} />;
      },
    },
    {
      key: 'rent',
      title: t('leases.fields.monthlyRent'),
      align: 'end',
      render: (l) => <Money amount={l.currentSegment?.monthlyRent ?? null} />,
    },
    {
      key: 'fee',
      title: t('taxiLicenses.fields.annualFeeDueAt'),
      sortKey: 'annualFeeDueAt',
      render: (l) => <AnnualFeeText date={l.annualFeeDueAt} alerts={l.alerts} />,
    },
    {
      key: 'alerts',
      title: t('vehicles.fields.alerts'),
      render: (l) => (
        <AlertTags enumName="TaxiLicenseAlert" alerts={l.alerts} />
      ),
    },
  ];

  const newButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/taxi-licenses/new')}>
      {t('taxiLicenses.new')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('taxiLicenses.searchPlaceholder')}
        filters={[
          {
            type: 'select',
            key: 'status',
            label: t('common.status'),
            options: statusOptions,
            multiple: true,
            width: 180,
          },
        ]}
        extra={newButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<TaxiLicenseListItem>
          label={t('nav.taxiLicenses')}
          data-testid="licenses-table"
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
          onRowClick={(l) => navigate(licensePath(l.id))}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('taxiLicenses.listEmpty')}
                description={t('taxiLicenses.listEmptyHint')}
                action={newButton}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
