import { PlusOutlined } from '@ant-design/icons';
import { VehicleOwnership, VehicleStatus } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Flex, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel, useEnumOptions } from '../../../shared/lib/enums';
import { useListParams } from '../../../shared/lib/listParams';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { KmText } from '../../../shared/ui/KmText';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { YearText } from '../../../shared/ui/YearText';
import { fetchVehicles } from '../api';
import { COMMON_MAKES } from '../lib/makes';
import { vehicleKeys } from '../queryKeys';
import type { VehicleListItem, VehicleListQuery } from '../types';

const MIN_FILTER_YEAR = 1990;

function yearParam(value: string | null): number | undefined {
  return value && /^\d{4}$/.test(value) ? Number(value) : undefined;
}

/** Registration expiry coloured by the server's alert codes. */
export function registrationClass(alerts: readonly string[]): string | undefined {
  if (alerts.includes('registrationExpired')) return 'rm-text-error';
  if (alerts.includes('registrationExpiring')) return 'rm-text-warning';
  return undefined;
}

/** Inventory list: filters in the URL, server paging and sorting. */
export function VehicleInventoryTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enumLabel = useEnumLabel();
  const statusOptions = useEnumOptions('VehicleStatus', VehicleStatus.options);
  const ownershipOptions = useEnumOptions('VehicleOwnership', VehicleOwnership.options);
  const { page, pageSize, sort, order, searchParams, setTableParams } = useListParams();

  const query = useMemo<VehicleListQuery>(
    () => ({
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') || undefined,
      ownership: searchParams.get('ownership') || undefined,
      isTaxi: searchParams.get('taxi') === '1' || undefined,
      make: searchParams.get('make') || undefined,
      yearFrom: yearParam(searchParams.get('yearFrom')),
      yearTo: yearParam(searchParams.get('yearTo')),
      page,
      pageSize,
      sort,
      order,
    }),
    [searchParams, page, pageSize, sort, order],
  );
  const filtered = Boolean(
    query.q || query.status || query.ownership || query.isTaxi || query.make || query.yearFrom || query.yearTo,
  );

  const list = useQuery({
    queryKey: vehicleKeys.list(query),
    queryFn: ({ signal }) => fetchVehicles(query, signal),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<VehicleListItem>[] = [
    {
      key: 'plate',
      title: t('vehicles.fields.plateNo'),
      sortKey: 'plateNo',
      mobile: 'title',
      render: (v) => (
        <Link to={`/vehicles/${encodeURIComponent(v.id)}`} aria-label={v.plateNo}>
          <PlateNo value={v.plateNo} />
        </Link>
      ),
    },
    {
      key: 'makeModel',
      title: t('vehicles.makeModel'),
      sortKey: 'make',
      mobile: 'title',
      render: (v) => (
        <Flex vertical>
          <AutoDir>{`${v.make} ${v.model}`}</AutoDir>
          {v.trim && (
            <Typography.Text type="secondary">
              <AutoDir>{v.trim}</AutoDir>
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    { key: 'year', title: t('vehicles.fields.year'), sortKey: 'year', render: (v) => <YearText value={v.year} /> },
    {
      key: 'km',
      title: t('vehicles.fields.currentKm'),
      sortKey: 'currentKm',
      align: 'end',
      render: (v) => <KmText value={v.currentKm} />,
    },
    {
      key: 'status',
      title: t('vehicles.fields.status'),
      sortKey: 'status',
      render: (v) => <StatusTag enumName="VehicleStatus" value={v.status} />,
    },
    {
      key: 'ownership',
      title: t('vehicles.fields.ownership'),
      render: (v) => (
        <Flex vertical>
          <span>{enumLabel('VehicleOwnership', v.ownership)}</span>
          {v.ownerDriver && (
            <Typography.Text type="secondary">
              <AutoDir>{v.ownerDriver.name}</AutoDir>
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      key: 'taxi',
      title: t('vehicles.taxi'),
      render: (v) =>
        v.isTaxi ? (
          <Flex gap={4} wrap>
            <ToneTag tone="accent">{t('vehicles.taxi')}</ToneTag>
            {v.registeredLicense && <LicenseTag licenseNo={v.registeredLicense.licenseNo} />}
          </Flex>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'registration',
      title: t('vehicles.fields.registrationExpiry'),
      sortKey: 'registrationExpiry',
      render: (v) => (
        <span className={registrationClass(v.alerts)}>
          <DateText value={v.registrationExpiry} />
        </span>
      ),
    },
    {
      key: 'price',
      title: t('vehicles.fields.listingPrice'),
      sortKey: 'listingPrice',
      align: 'end',
      render: (v) => <Money amount={v.listingPrice} decimals={false} />,
    },
    {
      key: 'alerts',
      title: t('vehicles.fields.alerts'),
      render: (v) => <AlertTags enumName="VehicleAlert" alerts={v.alerts} />,
    },
  ];

  const newButton = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vehicles/new')}>
      {t('vehicles.new')}
    </Button>
  );

  return (
    <Flex vertical gap={16}>
      <FilterBar
        searchPlaceholder={t('vehicles.searchPlaceholder')}
        filters={[
          {
            type: 'select',
            key: 'status',
            label: t('vehicles.fields.status'),
            options: statusOptions,
            multiple: true,
            width: 180,
          },
          {
            type: 'select',
            key: 'ownership',
            label: t('vehicles.fields.ownership'),
            options: ownershipOptions,
          },
          { type: 'autocomplete', key: 'make', label: t('vehicles.fields.make'), options: [...COMMON_MAKES] },
          {
            type: 'numberRange',
            keys: ['yearFrom', 'yearTo'],
            labels: [t('vehicles.yearFrom'), t('vehicles.yearTo')],
            min: MIN_FILTER_YEAR,
            max: new Date().getFullYear() + 1,
          },
          { type: 'toggle', key: 'taxi', label: t('vehicles.taxiOnly') },
        ]}
        extra={newButton}
      />
      {list.isError ? (
        <LoadError error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <DataTable<VehicleListItem>
          label={t('vehicles.tabs.inventory')}
          data-testid="vehicles-table"
          rowKey={(v) => v.id}
          columns={columns}
          data={list.data?.items}
          total={list.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          sort={sort}
          order={order}
          loading={list.isFetching}
          onChange={setTableParams}
          onRowClick={(v) => navigate(`/vehicles/${encodeURIComponent(v.id)}`)}
          empty={
            filtered ? (
              <EmptyState compact description={t('table.emptyFiltered')} />
            ) : (
              <EmptyState
                title={t('vehicles.listEmpty')}
                description={t('vehicles.listEmptyHint')}
                action={newButton}
              />
            )
          }
        />
      )}
    </Flex>
  );
}
