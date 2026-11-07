import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import type { DriverContractRow, DriverDetail } from '../types';

const leasePath = (id: string) => `/leases/${encodeURIComponent(id)}`;

/** The driver's lease contracts (newest first as the API sends them) and "new lease". */
export function DriverContractsTab({ driver }: { driver: DriverDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enumLabel = useEnumLabel();
  const newLease = () => navigate(`/leases/new?driverId=${encodeURIComponent(driver.id)}`);

  const columns: DataTableColumn<DriverContractRow>[] = [
    {
      key: 'no',
      title: t('leases.fields.contractNo'),
      mobile: 'title',
      render: (c) => (
        <Link to={leasePath(c.id)} className="rm-strong-link">
          <Ltr>{`#${c.contractNo}`}</Ltr>
        </Link>
      ),
    },
    {
      key: 'status',
      title: t('common.status'),
      mobile: 'title',
      render: (c) => <StatusTag enumName="LeaseStatus" value={c.status} />,
    },
    { key: 'type', title: t('leases.fields.type'), render: (c) => enumLabel('LeaseType', c.type) },
    {
      key: 'license',
      title: t('leases.fields.license'),
      render: (c) => <LicenseTag licenseNo={c.licenseNo} />,
    },
    {
      key: 'plate',
      title: t('leases.fields.vehicle'),
      render: (c) => <PlateNo value={c.plateNo} />,
    },
    {
      key: 'rent',
      title: t('leases.fields.monthlyRent'),
      align: 'end',
      render: (c) => <Money amount={c.monthlyRent} />,
    },
    {
      key: 'period',
      title: t('leases.fields.period'),
      render: (c) => (
        <span className="rm-nowrap">
          <DateText value={c.startDate} /> – <DateText value={c.actualEndDate ?? c.endDate} />
        </span>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="flex-end">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={newLease}
          disabled={driver.status !== 'ACTIVE'}
          data-testid="driver-new-lease"
        >
          {t('leases.new')}
        </Button>
      </Flex>
      <DataTable<DriverContractRow>
        label={t('drivers.tabs.contracts')}
        data-testid="driver-contracts-table"
        rowKey={(c) => c.id}
        columns={columns}
        data={driver.contracts ?? []}
        onRowClick={(c) => navigate(leasePath(c.id))}
        empty={<EmptyState compact description={t('drivers.noContracts')} />}
      />
    </Flex>
  );
}
