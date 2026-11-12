import {
  CarOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  EditOutlined,
  FileDoneOutlined,
  StopOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import type { ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { DetailPageLayout } from '../../../shared/ui/DetailPageLayout';
import { FactChips } from '../../../shared/ui/FactChips';
import { LifecycleSteps } from '../../../shared/ui/LifecycleSteps';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { TabLabel } from '../../../shared/ui/TabLabel';
import { ContactLink } from '../../contacts/components/ContactLink';
import { contactKeys } from '../../contacts/queryKeys';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { EntityDocuments } from '../../documents/components/EntityDocuments';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { fetchDeal } from '../api';
import { DealNo, DealTypeTag, DealVehicleCell, TransferCell } from '../components/DealBits';
import { DealPaymentsTab } from '../components/DealPaymentsTab';
import { DealSummaryTab } from '../components/DealSummaryTab';
import { TransferChecklist } from '../components/TransferChecklist';
import {
  CancelDealDialog,
  CompleteDialog,
  DealEditDialog,
  DealPaymentDialog,
  DisclosureDialog,
} from '../dialogs/DealDialogs';
import { counterpartyLabelKey, hasTransfer, isOpenDeal, needsDisclosure } from '../lib/dealRules';
import { dealKeys } from '../queryKeys';
import type { DealDetail } from '../types';

type DealActionKey = 'edit' | 'disclosure' | 'complete' | 'cancel' | 'payment';

/** `/deals/:id`: the deal with its actions by status, summary, payments, transfer and documents. */
export function DealDetailPage() {
  const { id } = useParams();
  return <DealView key={id} id={id ?? ''} />;
}

function DealView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DealActionKey | null>(null);

  const query = useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: ({ signal }) => fetchDeal(id, signal),
    enabled: Boolean(id),
  });

  /** Everything a deal change can move: deal lists, the car, contacts and the dashboard. */
  const refreshOthers = () => {
    const detailKey = dealKeys.detail(id);
    void queryClient.invalidateQueries({
      queryKey: dealKeys.all,
      predicate: (q) =>
        q.queryKey.length !== detailKey.length ||
        detailKey.some((part, i) => q.queryKey[i] !== part),
    });
    for (const key of [vehicleKeys.all, contactKeys.all, dashboardKeys.all]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  /** Action endpoints answer with the full deal: show it at once, refresh the rest. */
  const applyDeal = (updated: DealDetail, text?: string) => {
    setDialog(null);
    queryClient.setQueryData(dealKeys.detail(id), updated);
    refreshOthers();
    if (text) void message.success(text);
  };

  const section = { title: t('nav.deals'), to: '/deals' };
  if (query.isPending || query.isError) {
    return (
      <DetailPageLayout
        testId="deal"
        breadcrumbs={[section]}
        loading={query.isPending}
        error={query.error}
        errorTitle={t('deals.loadError')}
        notFoundTitle={t('deals.notFound')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const deal = query.data;
  const open = isOpenDeal(deal.status);
  const transfer = hasTransfer(deal);

  const actions: ActionDef<DealActionKey>[] = [];
  if (open) {
    const disclosure = needsDisclosure(deal.type);
    actions.push(
      {
        key: 'complete',
        label: t('deals.complete.action'),
        icon: <CheckCircleOutlined />,
        primary: !disclosure || Boolean(deal.disclosureSignedAt),
      },
      ...(disclosure
        ? [
            {
              key: 'disclosure' as const,
              label: t('deals.disclosure.action'),
              icon: <FileDoneOutlined />,
              primary: !deal.disclosureSignedAt,
            },
          ]
        : []),
      // A deposit can be taken before the deal is completed.
      { key: 'payment', label: t('deals.payments.add'), icon: <DollarOutlined /> },
      { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
      { key: 'cancel', label: t('deals.cancel.action'), icon: <StopOutlined />, danger: true },
    );
  } else if (deal.status === 'COMPLETED') {
    actions.push(
      {
        key: 'payment',
        label: t('deals.payments.add'),
        icon: <DollarOutlined />,
        primary: true,
      },
      { key: 'edit', label: t('actions.edit'), icon: <EditOutlined /> },
    );
  }

  return (
    <DetailPageLayout
      testId="deal"
      breadcrumbs={[section, { title: <DealNo no={deal.dealNo} /> }]}
      title={
        <span>
          {t('deals.detailTitle')} <DealNo no={deal.dealNo} />
        </span>
      }
      tags={
        <>
          <StatusTag enumName="DealStatus" value={deal.status} />
          <DealTypeTag type={deal.type} />
          <AlertTags enumName="DealAlert" alerts={deal.alerts} hideEmpty />
        </>
      }
      actions={{
        actions,
        onAction: (key) => setDialog(key),
        menuLabel: t('deals.actionsMenu'),
        testIdPrefix: 'deal-action',
      }}
      // A cancelled deal already has no actions at all.
      readOnlyReason={deal.status === 'CANCELLED' ? t('deals.readOnlyCancelled') : undefined}
      lifecycle={
        <div className="rm-lifecycle-row">
          <LifecycleSteps lifecycle="deal" status={deal.status} />
          {/* The ownership transfer starts once a sale is completed. */}
          {transfer && <LifecycleSteps lifecycle="transfer" status={deal.transferStatus} />}
        </div>
      }
      facts={
        <FactChips
          facts={[
            {
              key: 'vehicle',
              icon: <CarOutlined />,
              label: t('deals.fields.vehicle'),
              value: <DealVehicleCell vehicle={deal.vehicle} />,
            },
            {
              key: 'counterparty',
              icon: <UserOutlined />,
              label: t(counterpartyLabelKey(deal.type)),
              value: (
                <ContactLink
                  id={deal.counterparty?.id ?? deal.counterpartyId}
                  name={deal.counterparty?.name}
                />
              ),
            },
            {
              key: 'price',
              icon: <DollarOutlined />,
              label: t('deals.fields.price'),
              value: <Money amount={deal.price} />,
            },
            transfer && {
              key: 'transfer',
              icon: <SwapOutlined />,
              label: t('deals.fields.transfer'),
              value: (
                <TransferCell
                  status={deal.transferStatus}
                  dueAt={deal.transferDueAt}
                  transferredAt={deal.transferredAt}
                />
              ),
            },
          ]}
        />
      }
      tabs={[
        {
          key: 'summary',
          label: t('deals.tabs.summary'),
          children: <DealSummaryTab deal={deal} />,
        },
        {
          key: 'payments',
          label: <TabLabel label={t('deals.tabs.payments')} count={deal.payments.length} />,
          children: (
            <DealPaymentsTab
              deal={deal}
              canAdd={deal.status !== 'CANCELLED'}
              onAdd={() => setDialog('payment')}
              onChanged={(updated) => {
                if (updated) applyDeal(updated);
                else {
                  void queryClient.invalidateQueries({ queryKey: dealKeys.detail(id) });
                  refreshOthers();
                }
              }}
            />
          ),
        },
        // The transfer tab exists only for deals with an ownership transfer.
        ...(transfer
          ? [
              {
                key: 'transfer',
                label: t('deals.tabs.transfer'),
                children: <TransferChecklist deal={deal} onSaved={(d) => applyDeal(d)} />,
              },
            ]
          : []),
        {
          key: 'documents',
          label: <TabLabel label={t('deals.tabs.documents')} count={deal.documentCount} />,
          children: (
            <EntityDocuments
              owner={{ dealId: deal.id }}
              defaultKind={needsDisclosure(deal.type) ? 'DISCLOSURE_FORM' : 'AGREEMENT'}
              onChange={() =>
                void queryClient.invalidateQueries({ queryKey: dealKeys.detail(id) })
              }
            />
          ),
        },
      ]}
    >
      {dialog === 'edit' && (
        <DealEditDialog
          deal={deal}
          onClose={() => setDialog(null)}
          onSaved={(d) => applyDeal(d, t('common.saved'))}
        />
      )}
      {dialog === 'disclosure' && (
        <DisclosureDialog
          deal={deal}
          onClose={() => setDialog(null)}
          onSaved={(d) => applyDeal(d, t('deals.disclosure.saved'))}
        />
      )}
      {dialog === 'complete' && (
        <CompleteDialog
          deal={deal}
          onClose={() => setDialog(null)}
          onSaved={(d) => applyDeal(d, t('deals.complete.done'))}
        />
      )}
      {dialog === 'cancel' && (
        <CancelDealDialog
          deal={deal}
          onClose={() => setDialog(null)}
          onSaved={(d) => applyDeal(d, t('deals.cancel.done'))}
        />
      )}
      {dialog === 'payment' && (
        <DealPaymentDialog
          deal={deal}
          onClose={() => setDialog(null)}
          onSaved={(d) => applyDeal(d, t('deals.payments.saved'))}
        />
      )}
    </DetailPageLayout>
  );
}
