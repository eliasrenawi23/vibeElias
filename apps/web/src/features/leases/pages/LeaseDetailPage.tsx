import {
  CheckCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  ReloadOutlined,
  StopOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Badge, Card, Flex, Skeleton, Tabs, Tag } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { ActionBar, type ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { driverKeys } from '../../drivers/queryKeys';
import { fetchLedger } from '../../ledger/api';
import { LedgerStatement } from '../../ledger/components/LedgerStatement';
import { LedgerSummary } from '../../ledger/components/LedgerSummary';
import { PaymentDialog } from '../../ledger/dialogs/LedgerDialogs';
import { ledgerKeys } from '../../ledger/queryKeys';
import { taxiLicenseKeys } from '../../taxi-licenses/queryKeys';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { deleteLease, fetchLease } from '../api';
import { ContractNo } from '../components/ContractNo';
import { LeaseOverviewTab } from '../components/LeaseOverviewTab';
import { ActivateDialog } from '../dialogs/ActivateDialog';
import { ChecklistDialog } from '../dialogs/ChecklistDialog';
import { DepositDialog } from '../dialogs/DepositDialog';
import { EndLeaseDialog } from '../dialogs/EndLeaseDialog';
import { LeaseEditDialog } from '../dialogs/LeaseEditDialog';
import { RenewDialog } from '../dialogs/RenewDialog';
import { SegmentDialog } from '../dialogs/SegmentDialog';
import { LEASE_ALERT_COLORS, leasePath } from '../lib/leaseRules';
import { leaseKeys } from '../queryKeys';
import type { LeaseDetail } from '../types';
import { LeasesBackLink } from './LeaseNewPage';

const TAB_KEYS = ['overview', 'ledger', 'documents'] as const;
type LeaseTab = (typeof TAB_KEYS)[number];

function isTab(value: string | null): value is LeaseTab {
  return TAB_KEYS.includes(value as LeaseTab);
}

type LeaseActionKey =
  'edit' | 'activate' | 'delete' | 'payment' | 'segment' | 'deposit' | 'renew' | 'end';

type Dialog = LeaseActionKey | 'checklist-handover' | 'checklist-return' | null;

/** `/leases/:id`: the contract with its actions by status, overview, statement and documents. */
export function LeaseDetailPage() {
  const { id } = useParams();
  return <LeaseView key={id} id={id ?? ''} />;
}

function LeaseView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const enumLabel = useEnumLabel();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: LeaseTab = isTab(rawTab) ? rawTab : 'overview';
  const [dialog, setDialog] = useState<Dialog>(null);

  const query = useQuery({
    queryKey: leaseKeys.detail(id),
    queryFn: ({ signal }) => fetchLease(id, signal),
    enabled: Boolean(id),
  });

  /** Everything a lease change can move: lists, the driver, licences, cars, money, dashboard. */
  const refreshAll = () => {
    for (const key of [
      leaseKeys.all,
      driverKeys.all,
      taxiLicenseKeys.all,
      vehicleKeys.all,
      ledgerKeys.all,
      dashboardKeys.all,
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  /** Action endpoints answer with the full contract: show it at once, refresh the rest. */
  const applyLease = (updated: LeaseDetail, text: string) => {
    setDialog(null);
    queryClient.setQueryData(leaseKeys.detail(updated.id), updated);
    refreshAll();
    void message.success(text);
  };

  const remove = useMutation({
    mutationFn: () => deleteLease(id),
    onSuccess: () => {
      setDialog(null);
      queryClient.removeQueries({ queryKey: leaseKeys.detail(id) });
      refreshAll();
      void message.success(t('common.deleted'));
      navigate('/leases', { replace: true });
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

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
        title={t('leases.loadError')}
        notFoundTitle={t('leases.notFound')}
        onRetry={() => void query.refetch()}
        extra={<LeasesBackLink />}
      />
    );
  }

  const lease = query.data;
  const seg = lease.currentSegment;
  const actions: ActionDef<LeaseActionKey>[] = [];
  if (lease.status === 'DRAFT') {
    actions.push(
      {
        key: 'activate',
        label: t('leases.activate.action'),
        icon: <CheckCircleOutlined />,
        primary: true,
      },
      { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
      { key: 'delete', label: t('actions.delete'), icon: <DeleteOutlined />, danger: true },
    );
  } else if (lease.status === 'ACTIVE') {
    actions.push(
      {
        key: 'payment',
        label: t('ledger.payment.action'),
        icon: <DollarOutlined />,
        primary: true,
      },
      { key: 'segment', label: t('leases.segment.action'), icon: <SwapOutlined /> },
      { key: 'deposit', label: t('leases.deposit.action'), icon: <WalletOutlined /> },
      { key: 'renew', label: t('leases.renew.action'), icon: <ReloadOutlined /> },
      { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
      { key: 'end', label: t('leases.end.action'), icon: <StopOutlined />, danger: true },
    );
  } else {
    actions.push(
      {
        key: 'payment',
        label: t('ledger.payment.action'),
        icon: <DollarOutlined />,
        primary: true,
      },
      { key: 'deposit', label: t('leases.deposit.action'), icon: <WalletOutlined /> },
    );
  }

  return (
    <Flex vertical gap={16} data-testid="lease-detail">
      <LeasesBackLink />
      <Flex vertical gap={8}>
        <PageHeader
          title={
            <Flex gap={12} align="center" wrap component="span">
              <span>
                {t('leases.contract')} <ContractNo no={lease.contractNo} />
              </span>
              <Link
                to={`/drivers/${encodeURIComponent(lease.driver.id)}`}
                className="rm-lease-driver"
              >
                <AutoDir>{lease.driver.name}</AutoDir>
              </Link>
            </Flex>
          }
          extra={
            <ActionBar
              actions={actions}
              onAction={(key) => setDialog(key)}
              menuLabel={t('leases.actionsMenu')}
              testIdPrefix="lease-action"
            />
          }
        />
        <Flex gap={6} wrap align="center" data-testid="lease-tags">
          <StatusTag enumName="LeaseStatus" value={lease.status} />
          <Tag>{enumLabel('LeaseType', lease.type)}</Tag>
          {seg && <LicenseTag licenseNo={seg.taxiLicense.licenseNo} id={seg.taxiLicense.id} />}
          {seg?.vehicle && (
            <Link
              to={`/vehicles/${encodeURIComponent(seg.vehicle.id)}`}
              aria-label={seg.vehicle.plateNo}
            >
              <PlateNo value={seg.vehicle.plateNo} />
            </Link>
          )}
          <AlertTags
            alerts={lease.alerts}
            group="leases.alerts"
            colors={LEASE_ALERT_COLORS}
            hideEmpty
          />
        </Flex>
      </Flex>

      <Tabs
        className="rm-detail-tabs"
        more={{ trigger: ['click'] }}
        activeKey={tab}
        onChange={(key) => setParams(key === 'overview' ? {} : { tab: key }, { replace: true })}
        destroyOnHidden
        items={[
          {
            key: 'overview',
            label: t('leases.tabs.overview'),
            children: (
              <LeaseOverviewTab
                lease={lease}
                onEditChecklist={(kind) => setDialog(`checklist-${kind}`)}
              />
            ),
          },
          {
            key: 'ledger',
            label: t('leases.tabs.ledger'),
            children: (
              <LedgerStatement
                driverId={lease.driverId}
                contractId={lease.id}
                queryKey={(filters) => leaseKeys.ledger(lease.id, filters)}
                load={(filters, signal) =>
                  fetchLedger({ ...filters, contractId: lease.id }, signal)
                }
                hidePayment
                summary={
                  <LedgerSummary
                    balance={lease.balance?.balance}
                    depositHeld={lease.balance?.depositHeld}
                    charged={lease.balance?.charged}
                    paid={lease.balance?.paid}
                  />
                }
                onChanged={refreshAll}
              />
            ),
          },
          {
            key: 'documents',
            label: (
              <Flex gap={6} align="center">
                {t('leases.tabs.documents')}
                {lease.documentCount > 0 && (
                  <Badge count={lease.documentCount} size="small" color="gray" />
                )}
              </Flex>
            ),
            children: (
              <EntityDocuments
                owner={{ contractId: lease.id }}
                defaultKind="CONTRACT"
                onChange={() =>
                  void queryClient.invalidateQueries({ queryKey: leaseKeys.detail(id) })
                }
              />
            ),
          },
        ]}
      />

      {dialog === 'activate' && (
        <ActivateDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('leases.activate.done'))}
        />
      )}
      {dialog === 'edit' && (
        <LeaseEditDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('common.saved'))}
        />
      )}
      {dialog === 'segment' && (
        <SegmentDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('leases.segment.saved'))}
        />
      )}
      {dialog === 'deposit' && (
        <DepositDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('leases.deposit.saved'))}
        />
      )}
      {dialog === 'end' && (
        <EndLeaseDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('leases.end.done'))}
        />
      )}
      {dialog === 'renew' && (
        <RenewDialog
          lease={lease}
          onClose={() => setDialog(null)}
          onSaved={(renewed) => {
            applyLease(renewed, t('leases.renew.done'));
            navigate(leasePath(renewed.id));
          }}
        />
      )}
      {dialog === 'payment' && (
        <PaymentDialog
          driverId={lease.driverId}
          contractId={lease.id}
          suggestedAmount={lease.balance?.balance}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            refreshAll();
            void message.success(t('ledger.payment.saved'));
          }}
        />
      )}
      {(dialog === 'checklist-handover' || dialog === 'checklist-return') && (
        <ChecklistDialog
          lease={lease}
          kind={dialog === 'checklist-handover' ? 'handover' : 'return'}
          onClose={() => setDialog(null)}
          onSaved={(l) => applyLease(l, t('common.saved'))}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('leases.deleteTitle')}
        content={t('leases.deleteConfirm')}
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDialog(null)}
      />
    </Flex>
  );
}
