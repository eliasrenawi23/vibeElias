import {
  ArrowLeftOutlined,
  DollarOutlined,
  EditOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Badge, Button, Card, Flex, Skeleton, Tabs } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PhoneText } from '../../../shared/ui/PhoneText';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { fetchDriverLedger } from '../../ledger/api';
import { LedgerStatement } from '../../ledger/components/LedgerStatement';
import { LedgerSummary } from '../../ledger/components/LedgerSummary';
import { PaymentDialog } from '../../ledger/dialogs/LedgerDialogs';
import type { ContractOption } from '../../ledger/dialogs/ledgerForms';
import { ledgerKeys } from '../../ledger/queryKeys';
import { leaseKeys } from '../../leases/queryKeys';
import { fetchDriver } from '../api';
import { DriverContractsTab } from '../components/DriverContractsTab';
import { DriverProfileTab } from '../components/DriverProfileTab';
import { DriverEditDialog } from '../dialogs/DriverEditDialog';
import { DRIVER_ALERT_COLORS } from '../lib/driverRules';
import { driverKeys } from '../queryKeys';
import type { DriverDetail } from '../types';

const TAB_KEYS = ['profile', 'contracts', 'ledger', 'documents'] as const;
type DriverTab = (typeof TAB_KEYS)[number];

function isTab(value: string | null): value is DriverTab {
  return TAB_KEYS.includes(value as DriverTab);
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/drivers" className="rm-back-link">
      <ArrowLeftOutlined className="rm-flip-rtl" /> {t('common.backToList')}
    </Link>
  );
}

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
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: DriverTab = isTab(rawTab) ? rawTab : 'profile';
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

  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <LoadError
        error={query.error}
        title={t('drivers.loadError')}
        notFoundTitle={t('drivers.notFound')}
        onRetry={() => void query.refetch()}
        extra={<BackLink />}
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

  return (
    <Flex vertical gap={16} data-testid="driver-detail">
      <BackLink />
      <Flex vertical gap={8}>
        <PageHeader
          title={<AutoDir>{driver.name || '—'}</AutoDir>}
          extra={
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => setDialog('edit')}
                data-testid="driver-action-edit"
              >
                {t('actions.edit')}
              </Button>
              <Button
                icon={<FileAddOutlined />}
                disabled={driver.status !== 'ACTIVE'}
                onClick={() => navigate(`/leases/new?driverId=${encodeURIComponent(driver.id)}`)}
                data-testid="driver-action-lease"
              >
                {t('leases.new')}
              </Button>
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => setDialog('payment')}
                data-testid="driver-action-payment"
              >
                {t('ledger.payment.action')}
              </Button>
            </>
          }
        />
        <Flex gap={8} wrap align="center" data-testid="driver-tags">
          <StatusTag enumName="DriverStatus" value={driver.status} />
          {driver.contact?.phones?.[0] && <PhoneText value={driver.contact.phones[0]} />}
          <span>
            {t('ledger.fields.balance')}: <BalanceText amount={driver.balance?.balance ?? 0} />
          </span>
          <AlertTags
            alerts={driver.alerts}
            group="drivers.alerts"
            colors={DRIVER_ALERT_COLORS}
            hideEmpty
          />
        </Flex>
      </Flex>

      <Tabs
        className="rm-detail-tabs"
        more={{ trigger: ['click'] }}
        activeKey={tab}
        onChange={(key) => setParams(key === 'profile' ? {} : { tab: key }, { replace: true })}
        destroyOnHidden
        items={[
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
            label: (
              <Flex gap={6} align="center">
                {t('drivers.tabs.documents')}
                {driver.documentCount > 0 && (
                  <Badge count={driver.documentCount} size="small" color="gray" />
                )}
              </Flex>
            ),
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
      />

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
    </Flex>
  );
}
