import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { fetchLeases } from '../../leases/api';
import { ContractNo } from '../../leases/components/ContractNo';
import { leasePath } from '../../leases/lib/leaseRules';
import { leaseKeys } from '../../leases/queryKeys';
import type { LeaseListItem } from '../../leases/types';

/** Lease contracts this vehicle was part of (`GET /leases?vehicleId=`). */
export function VehicleLeasesTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enumLabel = useEnumLabel();
  const filters = { vehicleId, pageSize: 100 };
  const query = useQuery({
    queryKey: leaseKeys.list(filters),
    queryFn: ({ signal }) => fetchLeases(filters, signal),
  });

  const columns: DataTableColumn<LeaseListItem>[] = [
    {
      key: 'no',
      title: t('leases.fields.contractNo'),
      mobile: 'title',
      render: (l) => (
        <Link to={leasePath(l.id)}>
          <ContractNo no={l.contractNo} />
        </Link>
      ),
    },
    {
      key: 'status',
      title: t('common.status'),
      mobile: 'title',
      render: (l) => <StatusTag enumName="LeaseStatus" value={l.status} />,
    },
    {
      key: 'driver',
      title: t('leases.fields.driver'),
      render: (l) => (
        <Link to={`/drivers/${encodeURIComponent(l.driver.id)}`}>
          <AutoDir>{l.driver.name}</AutoDir>
        </Link>
      ),
    },
    { key: 'type', title: t('leases.fields.type'), render: (l) => enumLabel('LeaseType', l.type) },
    {
      key: 'license',
      title: t('leases.fields.license'),
      render: (l) => (
        <LicenseTag
          licenseNo={l.currentSegment?.taxiLicense.licenseNo}
          id={l.currentSegment?.taxiLicense.id}
        />
      ),
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
      render: (l) => (
        <span className="rm-nowrap">
          <DateText value={l.startDate} /> – <DateText value={l.actualEndDate ?? l.endDate} />
        </span>
      ),
    },
  ];

  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <DataTable<LeaseListItem>
      label={t('vehicles.detailTabs.leases')}
      data-testid="vehicle-leases-table"
      rowKey={(l) => l.id}
      columns={columns}
      data={query.data?.items}
      loading={query.isFetching}
      onRowClick={(l) => navigate(leasePath(l.id))}
      empty={<EmptyState compact description={t('vehicles.noLeases')} />}
    />
  );
}
