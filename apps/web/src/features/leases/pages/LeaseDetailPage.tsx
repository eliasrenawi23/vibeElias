import {
  BellOutlined,
  CarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  SwapOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { ReminderDialog } from '../../reminders/dialogs/ReminderDialog';
import { useErrorMessage } from '../../../shared/lib/i18n';
import type { ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DetailPageLayout } from '../../../shared/ui/DetailPageLayout';
import { FactChips } from '../../../shared/ui/FactChips';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { LifecycleSteps } from '../../../shared/ui/LifecycleSteps';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { TabLabel } from '../../../shared/ui/TabLabel';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { driverPath } from '../../drivers/lib/driverRules';
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
import { leasePath } from '../lib/leaseRules';
import { leaseKeys } from '../queryKeys';
import type { LeaseDetail } from '../types';

type LeaseActionKey =
  | 'edit'
  | 'activate'
  | 'delete'
  | 'payment'
  | 'segment'
  | 'deposit'
  | 'renew'
  | 'end'
  | 'reminder';

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

  const section = { title: t('nav.leases'), to: '/leases' };
  if (query.isPending || query.isError) {
    return (
      <DetailPageLayout
        testId="lease"
        breadcrumbs={[section]}
        loading={query.isPending}
        error={query.error}
        errorTitle={t('leases.loadError')}
        notFoundTitle={t('leases.notFound')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const lease = query.data;
  const seg = lease.currentSegment;
  const closed = lease.status === 'ENDED' || lease.status === 'TERMINATED';
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
  // Any contract can carry a manual reminder (call the driver, collect a cheque...).
  actions.push({ key: 'reminder', label: t('reminders.manual.add'), icon: <BellOutlined /> });

  return (
    <DetailPageLayout
      testId="lease"
      breadcrumbs={[section, { title: <ContractNo no={lease.contractNo} /> }]}
      title={
        <span>
          {t('leases.contract')} <ContractNo no={lease.contractNo} />
        </span>
      }
      tags={
        <>
          <StatusTag enumName="LeaseStatus" value={lease.status} />
          <StatusTag enumName="LeaseType" value={lease.type} />
          <AlertTags enumName="LeaseAlert" alerts={lease.alerts} hideEmpty />
        </>
      }
      actions={{
        actions,
        onAction: (key) => setDialog(key),
        menuLabel: t('leases.actionsMenu'),
        testIdPrefix: 'lease-action',
      }}
      // Ended / terminated contracts already offer only "record payment" and "deposit".
      readOnlyReason={closed ? t('leases.readOnlyClosed') : undefined}
      lifecycle={<LifecycleSteps lifecycle="lease" status={lease.status} />}
      facts={
        <FactChips
          facts={[
            {
              key: 'driver',
              icon: <UserOutlined />,
              label: t('leases.fields.driver'),
              value: (
                <Link to={driverPath(lease.driver.id)} className="rm-lease-driver">
                  <AutoDir>{lease.driver.name}</AutoDir>
                </Link>
              ),
            },
            seg && {
              key: 'license',
              icon: <SafetyCertificateOutlined />,
              label: t('leases.fields.license'),
              value: <LicenseTag licenseNo={seg.taxiLicense.licenseNo} id={seg.taxiLicense.id} />,
            },
            seg?.vehicle && {
              key: 'vehicle',
              icon: <CarOutlined />,
              label: t('leases.fields.vehicle'),
              value: (
                <Link
                  to={`/vehicles/${encodeURIComponent(seg.vehicle.id)}`}
                  aria-label={seg.vehicle.plateNo}
                >
                  <PlateNo value={seg.vehicle.plateNo} />
                </Link>
              ),
            },
            seg && {
              key: 'rent',
              icon: <DollarOutlined />,
              label: t('leases.fields.monthlyRent'),
              value: <Money amount={seg.monthlyRent} />,
            },
            {
              key: 'balance',
              icon: <WalletOutlined />,
              label: t('ledger.fields.balance'),
              value: <BalanceText amount={lease.balance?.balance ?? 0} />,
            },
          ]}
        />
      }
      tabs={[
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
              load={(filters, signal) => fetchLedger({ ...filters, contractId: lease.id }, signal)}
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
          label: <TabLabel label={t('leases.tabs.documents')} count={lease.documentCount} />,
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
    >
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
      {dialog === 'reminder' && (
        <ReminderDialog entityType="LEASE" entityId={lease.id} onClose={() => setDialog(null)} />
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
    </DetailPageLayout>
  );
}
