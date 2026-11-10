import {
  DollarOutlined,
  EditOutlined,
  FileAddOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import type { ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { DetailPageLayout } from '../../../shared/ui/DetailPageLayout';
import { FactChips } from '../../../shared/ui/FactChips';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { TabLabel } from '../../../shared/ui/TabLabel';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { fetchDriverLedger } from '../../ledger/api';
import { LedgerStatement } from '../../ledger/components/LedgerStatement';
import { LedgerSummary } from '../../ledger/components/LedgerSummary';
import { PaymentDialog } from '../../ledger/dialogs/LedgerDialogs';
import type { ContractOption } from '../../ledger/dialogs/ledgerForms';
import { ledgerKeys } from '../../ledger/queryKeys';
import { ContractNo } from '../../leases/components/ContractNo';
import { leasePath } from '../../leases/lib/leaseRules';
import { leaseKeys } from '../../leases/queryKeys';
import { fetchDriver } from '../api';
import { DriverContractsTab } from '../components/DriverContractsTab';
import { DriverProfileTab } from '../components/DriverProfileTab';
import { DriverEditDialog } from '../dialogs/DriverEditDialog';
import { driverKeys } from '../queryKeys';
import type { DriverDetail } from '../types';

type DriverActionKey = 'edit' | 'lease' | 'payment';

/** `/drivers/:id`: profile, contracts, ledger statement and documents of a driver. */
export function DriverDetailPage() {
  const { id } = useParams();
  return <DriverView key={id} id={id ?? ''} />;
}

function DriverView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<'edit' | 'payment' | null>(null);

  const query = useQuery({
    queryKey: driverKeys.detail(id),
    queryFn: ({ signal }) => fetchDriver(id, signal),
    enabled: Boolean(id),
  });

  /** Money moved: the driver (and its statement), leases, ledger lists and the dashboard. */
  const refreshMoney = () => {
    void queryClient.invalidateQueries({ queryKey: driverKeys.all });
    void queryClient.invalidateQueries({ queryKey: leaseKeys.all });
    void queryClient.invalidateQueries({ queryKey: ledgerKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };

  const section = { title: t('nav.drivers'), to: '/drivers' };
  if (query.isPending || query.isError) {
    return (
      <DetailPageLayout
        testId="driver"
        breadcrumbs={[section]}
        loading={query.isPending}
        error={query.error}
        errorTitle={t('drivers.loadError')}
        notFoundTitle={t('drivers.notFound')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const driver = query.data;
  const contracts: ContractOption[] = (driver.contracts ?? []).map((c) => ({
    id: c.id,
    contractNo: c.contractNo,
    isDefault: c.id === driver.activeContract?.id,
  }));

  const applyDriver = (updated: DriverDetail) => {
    queryClient.setQueryData(driverKeys.detail(id), updated);
    void queryClient.invalidateQueries({ queryKey: driverKeys.lists() });
  };

  const actions: ActionDef<DriverActionKey>[] = [
    { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
    {
      key: 'lease',
      label: t('leases.new'),
      icon: <FileAddOutlined />,
      disabled: driver.status !== 'ACTIVE',
    },
    {
      key: 'payment',
      label: t('ledger.payment.action'),
      icon: <DollarOutlined />,
      primary: true,
    },
  ];
  const onAction = (key: DriverActionKey) => {
    if (key === 'lease') navigate(`/leases/new?driverId=${encodeURIComponent(driver.id)}`);
    else setDialog(key);
  };
  const phone = driver.contact?.phones?.[0] || null;
  const active = driver.activeContract;

  return (
    <DetailPageLayout
      testId="driver"
      breadcrumbs={[section, { title: <AutoDir>{driver.name || '—'}</AutoDir> }]}
      title={<AutoDir>{driver.name || '—'}</AutoDir>}
      tags={
        <>
          <StatusTag enumName="DriverStatus" value={driver.status} />
          <AlertTags enumName="DriverAlert" alerts={driver.alerts} hideEmpty />
        </>
      }
      actions={{
        actions,
        onAction,
        menuLabel: t('drivers.actionsMenu'),
        testIdPrefix: 'driver-action',
      }}
      facts={
        <FactChips
          facts={[
            phone
              ? {
                  key: 'phone',
                  icon: <PhoneOutlined />,
                  label: t('common.phone'),
                  value: <PhoneText value={phone} />,
                }
              : null,
            {
              key: 'balance',
              icon: <WalletOutlined />,
              label: t('ledger.fields.balance'),
              value: <BalanceText amount={driver.balance?.balance ?? 0} />,
            },
            active && {
              key: 'contract',
              icon: <FileProtectOutlined />,
              label: t('drivers.fields.activeContract'),
              value: (
                <Link to={leasePath(active.id)}>
                  <ContractNo no={active.contractNo} />
                </Link>
              ),
            },
          ]}
        />
      }
      tabs={[
        {
          key: 'profile',
          label: t('drivers.tabs.profile'),
          children: <DriverProfileTab driver={driver} />,
        },
        {
          key: 'contracts',
          label: t('drivers.tabs.contracts'),
          children: <DriverContractsTab driver={driver} />,
        },
        {
          key: 'ledger',
          label: t('drivers.tabs.ledger'),
          children: (
            <LedgerStatement
              driverId={driver.id}
              contracts={contracts}
              queryKey={(filters) => driverKeys.ledger(driver.id, filters)}
              load={(filters, signal) => fetchDriverLedger(driver.id, filters, signal)}
              suggestedPayment={driver.balance?.balance}
              // The page header carries "record payment".
              hidePayment
              summary={
                <LedgerSummary
                  balance={driver.balance?.balance}
                  depositHeld={driver.balance?.depositHeld}
                  ageing={driver.ageing}
                />
              }
              onChanged={refreshMoney}
            />
          ),
        },
        {
          key: 'documents',
          label: <TabLabel label={t('drivers.tabs.documents')} count={driver.documentCount} />,
          children: (
            <EntityDocuments
              owner={{ driverId: driver.id }}
              onChange={() =>
                void queryClient.invalidateQueries({ queryKey: driverKeys.detail(id) })
              }
            />
          ),
        },
      ]}
    >
      {dialog === 'edit' && (
        <DriverEditDialog
          driver={driver}
          onClose={() => setDialog(null)}
          onSaved={(updated) => {
            setDialog(null);
            applyDriver(updated);
            void message.success(t('common.saved'));
          }}
        />
      )}
      {dialog === 'payment' && (
        <PaymentDialog
          driverId={driver.id}
          contracts={contracts}
          suggestedAmount={driver.balance?.balance}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refreshMoney();
            void message.success(t('ledger.payment.saved'));
          }}
        />
      )}
    </DetailPageLayout>
  );
}
