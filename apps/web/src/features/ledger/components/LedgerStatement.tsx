import { DollarOutlined, MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { LedgerType } from '@renawi/shared';
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import { App, Button, Flex } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useEnumOptions } from '../../../shared/lib/enums';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { ChargeDialog, CreditDialog, PaymentDialog, VoidDialog } from '../dialogs/LedgerDialogs';
import type { ContractOption } from '../dialogs/ledgerForms';
import { oldestFirst } from '../lib/ledger';
import type { LedgerEntry, LedgerQuery } from '../types';
import { LedgerTable } from './LedgerTable';

/** Statement filters kept in the URL (`from`, `to`, `type`, `voided=1`). */
export type StatementFilters = Omit<LedgerQuery, 'driverId' | 'contractId'>;

export interface LedgerStatementProps {
  driverId: string;
  /** Contract-scoped statement (lease page): entries are attached to this contract. */
  contractId?: string;
  /** Driver-level statement: contracts offered in the dialogs. */
  contracts?: readonly ContractOption[];
  queryKey: (filters: StatementFilters) => QueryKey;
  load: (filters: StatementFilters, signal?: AbortSignal) => Promise<{ items: LedgerEntry[] }>;
  /** Summary cards above the statement. */
  summary?: ReactNode;
  /** Prefilled payment amount (the open balance). */
  suggestedPayment?: number | null;
  /** Hide the "record payment" button (the page header has one). */
  hidePayment?: boolean;
  /** Called after any ledger change (refresh balances, lists...). */
  onChanged: () => void;
}

type Dialog =
  | { type: 'payment' }
  | { type: 'charge' }
  | { type: 'credit' }
  | { type: 'void'; entry: LedgerEntry }
  | null;

/** Statement with date / type filters, the voided toggle, and payment / charge / credit / void. */
export function LedgerStatement({
  driverId,
  contractId,
  contracts,
  queryKey,
  load,
  summary,
  suggestedPayment,
  hidePayment = false,
  onChanged,
}: LedgerStatementProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const typeOptions = useEnumOptions('LedgerType', LedgerType.options);
  const [params] = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(null);

  const filters = useMemo<StatementFilters>(
    () => ({
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
      type: params.get('type') || undefined,
      includeVoided: params.get('voided') === '1' || undefined,
    }),
    [params],
  );
  const filtered = Boolean(filters.from || filters.to || filters.type);

  const query = useQuery({
    queryKey: queryKey(filters),
    queryFn: ({ signal }) => load(filters, signal),
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => oldestFirst(query.data?.items ?? []), [query.data]);

  const saved = (text: string) => {
    setDialog(null);
    onChanged();
    void message.success(text);
  };
  const fixedContract = contractId === undefined ? undefined : contractId;

  return (
    <Flex vertical gap={16}>
      {summary}
      <FilterBar
        searchKey={null}
        filters={[
          {
            type: 'dateRange',
            keys: ['from', 'to'],
            label: `${t('common.from')} – ${t('common.to')}`,
          },
          {
            type: 'select',
            key: 'type',
            label: t('ledger.fields.type'),
            options: typeOptions,
            multiple: true,
            width: 200,
          },
          { type: 'toggle', key: 'voided', label: t('ledger.showVoided') },
        ]}
        extra={
          <>
            {!hidePayment && (
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => setDialog({ type: 'payment' })}
                data-testid="ledger-action-payment"
              >
                {t('ledger.payment.action')}
              </Button>
            )}
            <Button
              icon={<PlusCircleOutlined />}
              onClick={() => setDialog({ type: 'charge' })}
              data-testid="ledger-action-charge"
            >
              {t('ledger.charge.action')}
            </Button>
            <Button
              icon={<MinusCircleOutlined />}
              onClick={() => setDialog({ type: 'credit' })}
              data-testid="ledger-action-credit"
            >
              {t('ledger.credit.action')}
            </Button>
          </>
        }
      />
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <LedgerTable
          items={items}
          loading={query.isFetching}
          onVoid={(entry) => setDialog({ type: 'void', entry })}
          pdfActions
          onDocumentGenerated={() => void query.refetch()}
          empty={
            filtered ? <EmptyState compact description={t('table.emptyFiltered')} /> : undefined
          }
        />
      )}

      {dialog?.type === 'payment' && (
        <PaymentDialog
          driverId={driverId}
          contractId={fixedContract}
          contracts={contracts}
          suggestedAmount={suggestedPayment}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('ledger.payment.saved'))}
        />
      )}
      {dialog?.type === 'charge' && (
        <ChargeDialog
          driverId={driverId}
          contractId={fixedContract}
          contracts={contracts}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('ledger.charge.saved'))}
        />
      )}
      {dialog?.type === 'credit' && (
        <CreditDialog
          driverId={driverId}
          contractId={fixedContract}
          contracts={contracts}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('ledger.credit.saved'))}
        />
      )}
      {dialog?.type === 'void' && (
        <VoidDialog
          entry={dialog.entry}
          onClose={() => setDialog(null)}
          onSaved={() => saved(t('ledger.void.saved'))}
        />
      )}
    </Flex>
  );
}
