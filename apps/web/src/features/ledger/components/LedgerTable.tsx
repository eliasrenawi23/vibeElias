import { StopOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip, Typography } from 'antd';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { Money } from '../../../shared/ui/Money';
import { MonthText } from '../../../shared/ui/MonthText';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { isDeposit, openAmount, withRunningBalance, type StatementRow } from '../lib/ledger';
import type { LedgerEntry } from '../types';

export interface LedgerTableProps {
  /** Rows oldest to newest (as the statements return them). */
  items: readonly LedgerEntry[] | undefined;
  loading?: boolean;
  /** Balance before the first row when the running balance is computed here. */
  opening?: number;
  /** Shows a "void" action on rows that are not voided yet. */
  onVoid?: (entry: LedgerEntry) => void;
  empty?: ReactNode;
  label?: string;
  'data-testid'?: string;
}

/** Type tag: the charge kind for charges, the entry type otherwise (tones from the registry). */
export function LedgerTypeTag({ entry }: { entry: Pick<LedgerEntry, 'type' | 'chargeKind'> }) {
  if (entry.type === 'CHARGE' && entry.chargeKind) {
    return (
      <StatusTag enumName="ChargeKind" value={entry.chargeKind} data-kind={entry.chargeKind} />
    );
  }
  return <StatusTag enumName="LedgerType" value={entry.type} data-kind={entry.type} />;
}

/**
 * Driver statement: date, type / kind, description (a rent charge shows its month), charge and
 * payment columns, deposits, the running balance and what is still open on each charge.
 * Voided rows are struck through and do not count.
 */
export function LedgerTable({
  items,
  loading = false,
  opening = 0,
  onVoid,
  empty,
  label,
  'data-testid': testId = 'ledger-table',
}: LedgerTableProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const rows = useMemo(() => withRunningBalance(items ?? [], opening), [items, opening]);
  const dash = <span className="rm-empty-value">—</span>;

  const columns: DataTableColumn<StatementRow>[] = [
    {
      key: 'date',
      title: t('ledger.fields.date'),
      mobile: 'title',
      render: (e) => <DateText value={e.date} />,
    },
    {
      key: 'type',
      title: t('ledger.fields.type'),
      mobile: 'title',
      render: (e) => (
        <Flex gap={4} wrap>
          <LedgerTypeTag entry={e} />
          {e.voidedAt && <ToneTag tone="neutral" data-testid="ledger-voided-tag">{t('ledger.voided')}</ToneTag>}
        </Flex>
      ),
    },
    {
      key: 'description',
      title: t('ledger.fields.description'),
      render: (e) => (
        <Flex vertical gap={2} className="rm-ledger-description">
          {e.rentPeriod && (
            <span data-testid="ledger-rent-period">
              <MonthText value={e.rentPeriod} />
            </span>
          )}
          {e.description && <AutoDir>{e.description}</AutoDir>}
          {(e.method || e.reference) && (
            <Typography.Text type="secondary" className="rm-ledger-meta">
              {e.method ? enumLabel('PaymentMethod', e.method) : null}
              {e.method && e.reference ? ' · ' : null}
              {e.reference ? <Ltr>{e.reference}</Ltr> : null}
            </Typography.Text>
          )}
          {e.voidedAt && e.voidReason && (
            <Typography.Text type="secondary" className="rm-ledger-void-reason">
              {t('ledger.voidReasonShown')}: <AutoDir>{e.voidReason}</AutoDir>
            </Typography.Text>
          )}
          {!e.rentPeriod && !e.description && !e.method && !e.reference && dash}
        </Flex>
      ),
    },
    {
      key: 'charge',
      title: t('ledger.fields.charge'),
      align: 'end',
      render: (e) => (e.type === 'CHARGE' ? <Money amount={e.amount} /> : dash),
    },
    {
      key: 'payment',
      title: t('ledger.fields.payment'),
      align: 'end',
      render: (e) =>
        e.type === 'PAYMENT' || e.type === 'CREDIT' ? <Money amount={e.amount} /> : dash,
    },
    {
      key: 'deposit',
      title: t('ledger.fields.deposit'),
      align: 'end',
      mobile: 'hide',
      render: (e) =>
        isDeposit(e.type) ? (
          <Money amount={e.type === 'DEPOSIT_IN' ? e.amount : -Number(e.amount)} />
        ) : (
          dash
        ),
    },
    {
      key: 'balance',
      title: t('ledger.fields.runningBalance'),
      align: 'end',
      render: (e) =>
        e.balanceAfter === null ? dash : <BalanceText amount={e.balanceAfter} tooltip={false} />,
    },
    {
      key: 'open',
      title: t('ledger.fields.remaining'),
      align: 'end',
      render: (e) => {
        const open = openAmount(e);
        if (open === null) return dash;
        if (open <= 0) return <ToneTag tone="success">{t('ledger.paidUp')}</ToneTag>;
        return (
          <Flex vertical align="flex-end" gap={0}>
            <span className="rm-text-error" data-testid="ledger-remaining">
              <Money amount={open} />
            </span>
            {e.dueDate && (
              <Typography.Text type="secondary" className="rm-ledger-meta">
                {t('ledger.dueOn')} <DateText value={e.dueDate} />
              </Typography.Text>
            )}
          </Flex>
        );
      },
    },
    ...(onVoid
      ? [
          {
            key: 'actions',
            title: t('common.actions'),
            align: 'end' as const,
            render: (e: StatementRow) =>
              e.voidedAt ? null : (
                <Tooltip title={t('ledger.void.action')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<StopOutlined />}
                    aria-label={t('ledger.void.action')}
                    onClick={() => onVoid(e)}
                    data-testid="ledger-void"
                  />
                </Tooltip>
              ),
          },
        ]
      : []),
  ];

  return (
    <DataTable<StatementRow>
      label={label ?? t('ledger.title')}
      data-testid={testId}
      rowKey={(e) => e.id}
      columns={columns}
      data={rows}
      loading={loading}
      size="small"
      rowClassName={(e) => (e.voidedAt ? 'rm-ledger-voided' : undefined)}
      empty={empty ?? <EmptyState compact description={t('ledger.empty')} />}
    />
  );
}
