import {
  CarOutlined,
  DollarOutlined,
  EditOutlined,
  FileProtectOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { TaxiLicenseCreate } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Descriptions, Flex, Typography } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import type { ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { DESCRIPTION_COLUMNS } from '../../../shared/ui/descriptionColumns';
import { DetailPageLayout } from '../../../shared/ui/DetailPageLayout';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FactChips } from '../../../shared/ui/FactChips';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { TabLabel } from '../../../shared/ui/TabLabel';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { driverPath } from '../../drivers/lib/driverRules';
import { ContractNo } from '../../leases/components/ContractNo';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { fetchTaxiLicense, updateTaxiLicense } from '../api';
import { AnnualFeeText } from '../components/AnnualFeeText';
import { LicensePnlTab } from '../components/LicensePnlTab';
import { RegisterVehicleDialog } from '../dialogs/RegisterVehicleDialog';
import { TaxiLicenseForm } from '../forms/TaxiLicenseForm';
import { taxiLicenseKeys } from '../queryKeys';
import type { LicenseSegment, TaxiLicenseDetail } from '../types';

type LicenseActionKey = 'edit' | 'register';

const empty = <span className="rm-empty-value">—</span>;
const leasePath = (id: string) => `/leases/${encodeURIComponent(id)}`;

/** `/taxi-licenses/:id`: the licence file (details, assignments, registered car, documents). */
export function TaxiLicenseDetailPage() {
  const { id } = useParams();
  return <LicenseView key={id} id={id ?? ''} />;
}

function LicenseView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [registering, setRegistering] = useState(false);

  const query = useQuery({
    queryKey: taxiLicenseKeys.detail(id),
    queryFn: ({ signal }) => fetchTaxiLicense(id, signal),
    enabled: Boolean(id),
  });

  const apply = (updated: TaxiLicenseDetail) => {
    queryClient.setQueryData(taxiLicenseKeys.detail(id), updated);
    void queryClient.invalidateQueries({ queryKey: taxiLicenseKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: taxiLicenseKeys.available() });
  };

  const update = useMutation({
    mutationFn: (body: TaxiLicenseCreate) => updateTaxiLicense(id, body),
    onSuccess: (updated) => {
      apply(updated);
      setEditing(false);
      void message.success(t('common.saved'));
    },
  });

  const section = { title: t('nav.taxiLicenses'), to: '/taxi-licenses' };
  if (query.isPending || query.isError) {
    return (
      <DetailPageLayout
        testId="license"
        breadcrumbs={[section]}
        loading={query.isPending}
        error={query.error}
        errorTitle={t('taxiLicenses.loadError')}
        notFoundTitle={t('taxiLicenses.notFound')}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const license = query.data;
  const seg = license.currentSegment;
  const actions: ActionDef<LicenseActionKey>[] = [
    { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
    { key: 'register', label: t('taxiLicenses.register.action'), icon: <CarOutlined /> },
  ];

  return (
    <DetailPageLayout
      testId="license"
      breadcrumbs={[section, { title: <Ltr>{license.licenseNo}</Ltr> }]}
      title={
        <Flex gap={12} align="center" wrap component="span">
          <span className="rm-license-title">
            <LicenseTag licenseNo={license.licenseNo} />
          </span>
          {license.holderName && <AutoDir>{license.holderName}</AutoDir>}
        </Flex>
      }
      tags={
        <>
          <StatusTag enumName="TaxiLicenseStatus" value={license.status} />
          <AlertTags enumName="TaxiLicenseAlert" alerts={license.alerts} hideEmpty />
        </>
      }
      actions={
        editing
          ? null
          : {
              actions,
              onAction: (key) => (key === 'edit' ? setEditing(true) : setRegistering(true)),
              menuLabel: t('taxiLicenses.actionsMenu'),
              testIdPrefix: 'license-action',
            }
      }
      facts={
        !editing && (
          <FactChips
            facts={[
              {
                key: 'vehicle',
                icon: <CarOutlined />,
                label: t('taxiLicenses.fields.registeredVehicle'),
                value: license.registeredVehicle ? (
                  <Link
                    to={`/vehicles/${encodeURIComponent(license.registeredVehicle.id)}`}
                    aria-label={license.registeredVehicle.plateNo}
                  >
                    <PlateNo value={license.registeredVehicle.plateNo} />
                  </Link>
                ) : (
                  empty
                ),
              },
              seg && {
                key: 'driver',
                icon: <UserOutlined />,
                label: t('leases.fields.driver'),
                value: (
                  <Link to={driverPath(seg.driver.id)}>
                    <AutoDir>{seg.driver.name}</AutoDir>
                  </Link>
                ),
              },
              seg && {
                key: 'contract',
                icon: <FileProtectOutlined />,
                label: t('leases.fields.contractNo'),
                value: (
                  <Link to={leasePath(seg.contractId)}>
                    <ContractNo no={seg.contractNo} />
                  </Link>
                ),
              },
              seg && {
                key: 'rent',
                icon: <DollarOutlined />,
                label: t('leases.fields.monthlyRent'),
                value: <Money amount={seg.monthlyRent} />,
              },
            ]}
          />
        )
      }
      tabs={
        editing
          ? null
          : [
              {
                key: 'overview',
                label: t('taxiLicenses.tabs.overview'),
                children: <LicenseOverview license={license} />,
              },
              {
                key: 'documents',
                label: (
                  <TabLabel
                    label={t('taxiLicenses.tabs.documents')}
                    count={license.documentCount}
                  />
                ),
                children: (
                  <EntityDocuments
                    owner={{ taxiLicenseId: license.id }}
                    defaultKind="TAXI_LICENSE"
                    onChange={() =>
                      void queryClient.invalidateQueries({ queryKey: taxiLicenseKeys.detail(id) })
                    }
                  />
                ),
              },
              {
                key: 'pnl',
                label: t('taxiLicenses.tabs.pnl'),
                children: <LicensePnlTab licenseId={license.id} />,
              },
            ]
      }
    >
      {editing && (
        <TaxiLicenseForm
          license={license}
          onSubmit={(values) => update.mutateAsync(values)}
          submitting={update.isPending}
          onCancel={() => setEditing(false)}
        />
      )}

      {registering && (
        <RegisterVehicleDialog
          license={license}
          onClose={() => setRegistering(false)}
          onSaved={(updated) => {
            setRegistering(false);
            apply(updated);
            void queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
            void message.success(
              updated.registeredVehicle
                ? t('taxiLicenses.register.registered')
                : t('taxiLicenses.register.cleared'),
            );
          }}
        />
      )}
    </DetailPageLayout>
  );
}

function LicenseOverview({ license: l }: { license: TaxiLicenseDetail }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const text = (v: string | null | undefined): ReactNode => (v ? <AutoDir>{v}</AutoDir> : empty);
  const seg = l.currentSegment;

  const historyColumns: DataTableColumn<LicenseSegment>[] = [
    {
      key: 'contract',
      title: t('leases.fields.contractNo'),
      mobile: 'title',
      render: (s) => (
        <Link to={leasePath(s.contractId)}>
          <Ltr>{`#${s.contractNo}`}</Ltr>
        </Link>
      ),
    },
    {
      key: 'driver',
      title: t('leases.fields.driver'),
      mobile: 'title',
      render: (s) => (
        <Link to={`/drivers/${encodeURIComponent(s.driver.id)}`}>
          <AutoDir>{s.driver.name}</AutoDir>
        </Link>
      ),
    },
    {
      key: 'vehicle',
      title: t('leases.fields.vehicle'),
      render: (s) => <PlateNo value={s.vehicle?.plateNo} />,
    },
    {
      key: 'rent',
      title: t('leases.fields.monthlyRent'),
      align: 'end',
      render: (s) => <Money amount={s.monthlyRent} />,
    },
    {
      key: 'period',
      title: t('leases.fields.period'),
      render: (s) => (
        <span className="rm-nowrap">
          <DateText value={s.startDate} /> –{' '}
          {s.endDate ? <DateText value={s.endDate} /> : t('vehicles.cycles.now')}
        </span>
      ),
    },
    { key: 'reason', title: t('leases.fields.segmentReason'), render: (s) => text(s.reason) },
  ];

  return (
    <Flex vertical gap={16}>
      <Card variant="borderless" title={t('common.details')}>
        <Descriptions
          column={DESCRIPTION_COLUMNS}
          size="small"
          items={[
            {
              key: 'no',
              label: t('taxiLicenses.fields.licenseNo'),
              children: <LicenseTag licenseNo={l.licenseNo} />,
            },
            {
              key: 'holder',
              label: t('taxiLicenses.fields.holderName'),
              children: text(l.holderName),
            },
            {
              key: 'status',
              label: t('common.status'),
              children: <StatusTag enumName="TaxiLicenseStatus" value={l.status} />,
            },
            {
              key: 'registered',
              label: t('taxiLicenses.fields.registeredVehicle'),
              children: l.registeredVehicle ? (
                <Link
                  to={`/vehicles/${encodeURIComponent(l.registeredVehicle.id)}`}
                  aria-label={l.registeredVehicle.plateNo}
                >
                  <PlateNo value={l.registeredVehicle.plateNo} />
                </Link>
              ) : (
                empty
              ),
            },
            {
              key: 'fee',
              label: t('taxiLicenses.fields.annualFeeDueAt'),
              children: <AnnualFeeText date={l.annualFeeDueAt} alerts={l.alerts} />,
            },
            {
              key: 'renewal',
              label: t('taxiLicenses.fields.renewalAt'),
              children: <DateText value={l.renewalAt} />,
            },
            {
              key: 'acquiredAt',
              label: t('taxiLicenses.fields.acquiredAt'),
              children: <DateText value={l.acquiredAt} />,
            },
            {
              key: 'acquisitionPrice',
              label: t('taxiLicenses.fields.acquisitionPrice'),
              children: <Money amount={l.acquisitionPrice} decimals={false} />,
            },
            ...(l.status === 'SOLD'
              ? [
                  {
                    key: 'soldAt',
                    label: t('taxiLicenses.fields.soldAt'),
                    children: <DateText value={l.soldAt} />,
                  },
                  {
                    key: 'salePrice',
                    label: t('taxiLicenses.fields.salePrice'),
                    children: <Money amount={l.salePrice} decimals={false} />,
                  },
                ]
              : []),
            {
              key: 'notes',
              label: t('common.notes'),
              span: 'filled' as const,
              children: l.notes ? (
                <Typography.Paragraph className="rm-pre-wrap" dir="auto">
                  {l.notes}
                </Typography.Paragraph>
              ) : (
                empty
              ),
            },
          ]}
        />
      </Card>

      <Card
        variant="borderless"
        title={t('taxiLicenses.assignment.current')}
        data-testid="license-current"
      >
        {seg ? (
          <Descriptions
            column={DESCRIPTION_COLUMNS}
            size="small"
            items={[
              {
                key: 'contract',
                label: t('leases.fields.contractNo'),
                children: (
                  <Link to={leasePath(seg.contractId)}>
                    <Ltr>{`#${seg.contractNo}`}</Ltr>
                  </Link>
                ),
              },
              {
                key: 'driver',
                label: t('leases.fields.driver'),
                children: (
                  <Link to={`/drivers/${encodeURIComponent(seg.driver.id)}`}>
                    <AutoDir>{seg.driver.name}</AutoDir>
                  </Link>
                ),
              },
              {
                key: 'vehicle',
                label: t('leases.fields.vehicle'),
                children: <PlateNo value={seg.vehicle?.plateNo} />,
              },
              {
                key: 'rent',
                label: t('leases.fields.monthlyRent'),
                children: <Money amount={seg.monthlyRent} />,
              },
              {
                key: 'since',
                label: t('taxiLicenses.assignment.since'),
                children: <DateText value={seg.startDate} />,
              },
            ]}
          />
        ) : (
          <EmptyState
            compact
            description={t('taxiLicenses.assignment.none')}
            action={
              l.status === 'ACTIVE' && (
                <Button type="primary" onClick={() => navigate('/leases/new')}>
                  {t('leases.new')}
                </Button>
              )
            }
          />
        )}
      </Card>

      <Card variant="borderless" title={t('taxiLicenses.assignment.history')}>
        <DataTable<LicenseSegment>
          label={t('taxiLicenses.assignment.history')}
          data-testid="license-history-table"
          rowKey={(s) => s.id}
          columns={historyColumns}
          data={l.segments ?? []}
          size="small"
          empty={<EmptyState compact description={t('taxiLicenses.assignment.noHistory')} />}
        />
      </Card>
    </Flex>
  );
}
