import {
  CheckCircleOutlined,
  DollarOutlined,
  EditOutlined,
  FileDoneOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Badge, Card, Flex, Skeleton, Tabs } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { ActionBar, type ActionDef } from '../../../shared/ui/ActionBar';
import { AlertTags } from '../../../shared/ui/AlertTags';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatusTag } from '../../../shared/ui/StatusTag';
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
import {
  counterpartyLabelKey,
  DEAL_ALERT_COLORS,
  hasTransfer,
  isOpenDeal,
  needsDisclosure,
} from '../lib/dealRules';
import { dealKeys } from '../queryKeys';
import type { DealDetail } from '../types';
import { DealsBackLink } from './DealNewPage';

const TAB_KEYS = ['summary', 'payments', 'transfer', 'documents'] as const;
type DealTab = (typeof TAB_KEYS)[number];

function isTab(value: string | null): value is DealTab {
  return TAB_KEYS.includes(value as DealTab);
}

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
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
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
        title={t('deals.loadError')}
        notFoundTitle={t('deals.notFound')}
        onRetry={() => void query.refetch()}
        extra={<DealsBackLink />}
      />
    );
  }

  const deal = query.data;
  const open = isOpenDeal(deal.status);
  const transfer = hasTransfer(deal);
  const tab: DealTab = isTab(rawTab) && (rawTab !== 'transfer' || transfer) ? rawTab : 'summary';

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
    <Flex vertical gap={16} data-testid="deal-detail">
      <DealsBackLink />
      <Flex vertical gap={8}>
        <PageHeader
          title={
            <Flex gap={12} align="center" wrap component="span">
              <span>
                {t('deals.detailTitle')} <DealNo no={deal.dealNo} />
              </span>
              <DealTypeTag type={deal.type} />
            </Flex>
          }
          extra={
            <ActionBar
              actions={actions}
              onAction={(key) => setDialog(key)}
              menuLabel={t('deals.actionsMenu')}
              testIdPrefix="deal-action"
            />
          }
        />
        <Flex gap={12} wrap align="center" data-testid="deal-tags">
          <StatusTag enumName="DealStatus" value={deal.status} />
          <DealVehicleCell vehicle={deal.vehicle} />
          <span>
            <span className="rm-muted-label">{t(counterpartyLabelKey(deal.type))}:</span>{' '}
            <ContactLink
              id={deal.counterparty?.id ?? deal.counterpartyId}
              name={deal.counterparty?.name}
            />
          </span>
          {transfer && (
            <TransferCell
              status={deal.transferStatus}
              dueAt={deal.transferDueAt}
              transferredAt={deal.transferredAt}
            />
          )}
          <AlertTags
            alerts={deal.alerts}
            group="deals.alerts"
            colors={DEAL_ALERT_COLORS}
            hideEmpty
          />
        </Flex>
      </Flex>

      <Tabs
        className="rm-detail-tabs"
        more={{ trigger: ['click'] }}
        activeKey={tab}
        onChange={(key) => setParams(key === 'summary' ? {} : { tab: key }, { replace: true })}
        destroyOnHidden
        items={[
          {
            key: 'summary',
            label: t('deals.tabs.summary'),
            children: <DealSummaryTab deal={deal} />,
          },
          {
            key: 'payments',
            label: (
              <Flex gap={6} align="center">
                {t('deals.tabs.payments')}
                {deal.payments.length > 0 && (
                  <Badge count={deal.payments.length} size="small" color="gray" />
                )}
              </Flex>
            ),
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
            label: (
              <Flex gap={6} align="center">
                {t('deals.tabs.documents')}
                {deal.documentCount > 0 && (
                  <Badge count={deal.documentCount} size="small" color="gray" />
                )}
              </Flex>
            ),
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
      />

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
    </Flex>
  );
}
