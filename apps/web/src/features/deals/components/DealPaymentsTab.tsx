import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { App, Button, Col, Flex, Row, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { toneOf } from '../../../shared/lib/statusTones';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Money } from '../../../shared/ui/Money';
import { StatCard } from '../../../shared/ui/StatCard';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { ContactLink } from '../../contacts/components/ContactLink';
import { PdfRowButton } from '../../documents/components/GeneratePdf';
import { dealPaymentPdfChoice } from '../../documents/pdf';
import { deleteDealPayment } from '../api';
import { isSystemPayment } from '../lib/dealRules';
import type { DealDetail, DealPayment } from '../types';

export interface DealPaymentsTabProps {
  deal: DealDetail;
  /** Recording payments is offered once the deal is completed. */
  canAdd: boolean;
  onAdd: () => void;
  /** After a delete: the deal when the API sent it back, else null (refetch). */
  onChanged: (deal: DealDetail | null) => void;
}

/** Paid / due summary and the payments of the deal (trade-in rows are system rows). */
export function DealPaymentsTab({ deal, canAdd, onAdd, onChanged }: DealPaymentsTabProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const enumLabel = useEnumLabel();
  const [deleting, setDeleting] = useState<DealPayment | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteDealPayment(id),
    onSuccess: (updated) => {
      setDeleting(null);
      onChanged(updated);
      void message.success(t('deals.payments.deleted'));
    },
    onError: (error) => {
      setDeleting(null);
      void message.error(errorMessage(error));
    },
  });

  const columns: DataTableColumn<DealPayment>[] = [
    {
      key: 'date',
      title: t('ledger.fields.date'),
      mobile: 'title',
      render: (p) => <DateText value={p.date} />,
    },
    {
      key: 'direction',
      title: t('deals.payments.direction'),
      mobile: 'title',
      render: (p) => (
        <ToneTag tone={toneOf('Direction', p.direction)} data-direction={p.direction}>
          {t(`deals.payments.directions.${p.direction}`)}
        </ToneTag>
      ),
    },
    {
      key: 'amount',
      title: t('ledger.fields.amount'),
      align: 'end',
      render: (p) => <Money amount={p.amount} />,
    },
    {
      key: 'method',
      title: t('ledger.fields.method'),
      render: (p) => (
        <Flex gap={4} align="center" wrap>
          {enumLabel('PaymentMethod', p.method)}
          {isSystemPayment(p) && (
            <Tooltip title={t('deals.payments.systemHint')}>
              <ToneTag tone="neutral" icon={<LockOutlined />} data-testid="payment-system">
                {t('deals.payments.system')}
              </ToneTag>
            </Tooltip>
          )}
        </Flex>
      ),
    },
    {
      key: 'reference',
      title: t('ledger.fields.reference'),
      render: (p) =>
        p.reference ? (
          <bdi dir="ltr">{p.reference}</bdi>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'contact',
      title: t('deals.payments.contact'),
      render: (p) => <ContactLink id={p.contact?.id} name={p.contact?.name} />,
    },
    {
      key: 'notes',
      title: t('common.notes'),
      render: (p) =>
        p.notes ? (
          <Typography.Text className="rm-cell-text" ellipsis={{ tooltip: p.notes }}>
            <AutoDir>{p.notes}</AutoDir>
          </Typography.Text>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      align: 'end',
      render: (p) => {
        const pdf = dealPaymentPdfChoice(p, deal.status);
        return (
          <Flex gap={2} justify="flex-end">
            {pdf && <PdfRowButton choice={pdf} />}
            {!isSystemPayment(p) && (
              <Tooltip title={t('actions.delete')}>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('actions.delete')}
                  onClick={() => setDeleting(p)}
                  data-testid="payment-delete"
                />
              </Tooltip>
            )}
          </Flex>
        );
      },
    },
  ];

  const payout = deal.type === 'CONSIGNMENT_SALE';
  return (
    <Flex vertical gap={16}>
      <Row gutter={[16, 16]} data-testid="deal-payment-summary">
        <Col xs={12} md={6}>
          <StatCard title={t('deals.fields.paidIn')} data-testid="summary-paid-in">
            <Money amount={deal.paidIn} />
          </StatCard>
        </Col>
        <Col xs={12} md={6}>
          <StatCard title={t('deals.fields.paidOut')} data-testid="summary-paid-out">
            <Money amount={deal.paidOut} />
          </StatCard>
        </Col>
        <Col xs={12} md={6}>
          <StatCard title={t('deals.fields.balanceDue')} data-testid="summary-balance-due">
            <span className={deal.balanceDue > 0.004 ? 'rm-overdue' : undefined}>
              <Money amount={deal.balanceDue} />
            </span>
          </StatCard>
        </Col>
        {payout ? (
          <Col xs={12} md={6}>
            <StatCard title={t('deals.fields.payoutDue')} data-testid="summary-payout-due">
              <Money amount={deal.payoutDue ?? 0} />
            </StatCard>
          </Col>
        ) : (
          deal.tradeInValue !== null &&
          deal.tradeInValue !== undefined &&
          deal.tradeInValue > 0 && (
            <Col xs={12} md={6}>
              <StatCard title={t('deals.fields.tradeInValue')} data-testid="summary-trade-in">
                <Money amount={deal.tradeInValue} />
              </StatCard>
            </Col>
          )
        )}
      </Row>

      <Flex justify="space-between" align="center" gap={8} wrap>
        <Typography.Title level={5} className="rm-section-title">
          {t('deals.payments.title')}
        </Typography.Title>
        {canAdd ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd} data-testid="payment-add">
            {t('deals.payments.add')}
          </Button>
        ) : (
          <Typography.Text type="secondary">{t('deals.payments.cancelled')}</Typography.Text>
        )}
      </Flex>

      <DataTable<DealPayment>
        label={t('deals.payments.title')}
        data-testid="deal-payments-table"
        rowKey={(p) => p.id}
        columns={columns}
        data={deal.payments}
        size="small"
        empty={<EmptyState compact description={t('deals.payments.empty')} />}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('deals.payments.deleteTitle')}
        content={t('deals.payments.deleteConfirm')}
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </Flex>
  );
}
