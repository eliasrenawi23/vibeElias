import { DeleteOutlined, EditOutlined, PlusOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { ExpenseCategory, PaidBy } from '@renawi/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { App, Button, Card, Flex, Statistic, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumLabel, useEnumOptions } from '../../../shared/lib/enums';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { toneOf } from '../../../shared/lib/statusTones';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { ContactLink } from '../../contacts/components/ContactLink';
import { deleteExpense, fetchExpenses } from '../api';
import { ExpenseDialog } from '../dialogs/ExpenseDialog';
import { RebillExpenseDialog } from '../dialogs/RebillExpenseDialog';
import { vehicleKeys } from '../queryKeys';
import type { ExpenseListQuery, VehicleExpense } from '../types';

export interface VehicleExpensesTabProps {
  vehicleId: string;
  /** Taxis: expenses we paid can be rebilled to the driver who had the car. */
  isTaxi?: boolean;
  /** Opens the "add expense" dialog (shared with the page header action). */
  onAdd: () => void;
  /** Called after an expense was edited or deleted. */
  onChanged: () => void;
}

/** Expenses of a vehicle with date / category filters (in the URL) and per-category totals. */
export function VehicleExpensesTab({
  vehicleId,
  isTaxi = false,
  onAdd,
  onChanged,
}: VehicleExpensesTabProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const enumLabel = useEnumLabel();
  const categoryOptions = useEnumOptions('ExpenseCategory', ExpenseCategory.options);
  const paidByOptions = useEnumOptions('PaidBy', PaidBy.options);
  const [params] = useSearchParams();
  const [editing, setEditing] = useState<VehicleExpense | null>(null);
  const [deleting, setDeleting] = useState<VehicleExpense | null>(null);
  const [rebilling, setRebilling] = useState<VehicleExpense | null>(null);

  const filters = useMemo<ExpenseListQuery>(
    () => ({
      from: params.get('from') || undefined,
      to: params.get('to') || undefined,
      category: params.get('category') || undefined,
      paidBy: PaidBy.safeParse(params.get('paidBy')).data,
    }),
    [params],
  );
  const filtered = Boolean(filters.from || filters.to || filters.category || filters.paidBy);

  const query = useQuery({
    queryKey: vehicleKeys.expenses(vehicleId, filters),
    queryFn: ({ signal }) => fetchExpenses(vehicleId, filters, signal),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      setDeleting(null);
      onChanged();
      void message.success(t('common.deleted'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  const columns: DataTableColumn<VehicleExpense>[] = [
    {
      key: 'date',
      title: t('vehicles.expenses.date'),
      mobile: 'title',
      render: (e) => <DateText value={e.date} />,
    },
    {
      key: 'category',
      title: t('vehicles.expenses.category'),
      mobile: 'title',
      render: (e) => (
        <StatusTag
          enumName="ExpenseCategory"
          value={e.category}
          className="rm-expense-category"
        />
      ),
    },
    {
      key: 'vendor',
      title: t('vehicles.expenses.vendor'),
      render: (e) =>
        e.vendorId ? (
          <ContactLink id={e.vendorId} name={e.vendor?.name} />
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'amount',
      title: t('vehicles.expenses.amount'),
      align: 'end',
      render: (e) => <Money amount={e.amount} />,
    },
    {
      key: 'paidBy',
      title: t('vehicles.expenses.paidBy'),
      render: (e) => enumLabel('PaidBy', e.paidBy),
    },
    {
      key: 'vat',
      title: t('vehicles.expenses.vat'),
      render: (e) =>
        e.vatIncluded || e.vatReclaimable ? (
          <Flex gap={4} wrap>
            {e.vatIncluded && <ToneTag tone="neutral">{t('vehicles.expenses.vatIncludedShort')}</ToneTag>}
            {e.vatReclaimable && (
              <ToneTag tone="success">{t('vehicles.expenses.vatReclaimableShort')}</ToneTag>
            )}
          </Flex>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'description',
      title: t('vehicles.expenses.description'),
      render: (e) =>
        e.description ? (
          <Typography.Text className="rm-cell-text" ellipsis={{ tooltip: e.description }}>
            <AutoDir>{e.description}</AutoDir>
          </Typography.Text>
        ) : (
          <span className="rm-empty-value">—</span>
        ),
    },
    {
      key: 'actions',
      title: t('common.actions'),
      align: 'end',
      render: (e) => (
        <Flex gap={4} justify="flex-end" align="center">
          {e.rebilledEntryId ? (
            <ToneTag tone="success" data-testid="expense-rebilled">
              {t('vehicles.expenses.rebilledTag')}
            </ToneTag>
          ) : (
            isTaxi &&
            e.paidBy === 'US' && (
              <Tooltip title={t('vehicles.expenses.rebill')}>
                <Button
                  type="text"
                  size="small"
                  icon={<UserSwitchOutlined />}
                  aria-label={t('vehicles.expenses.rebill')}
                  onClick={() => setRebilling(e)}
                  data-testid="expense-rebill"
                />
              </Tooltip>
            )
          )}
          <Tooltip title={t('actions.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t('actions.edit')}
              onClick={() => setEditing(e)}
            />
          </Tooltip>
          <Tooltip title={t('actions.delete')}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('actions.delete')}
              onClick={() => setDeleting(e)}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  const summary = query.data?.summary;

  return (
    <Flex vertical gap={16}>
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
            key: 'category',
            label: t('vehicles.expenses.category'),
            options: categoryOptions,
            multiple: true,
            width: 200,
          },
          {
            type: 'select',
            key: 'paidBy',
            label: t('vehicles.expenses.paidBy'),
            options: paidByOptions,
          },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {t('vehicles.actions.addExpense')}
          </Button>
        }
      />

      {summary && summary.total > 0 && (
        <Card variant="borderless" size="small" data-testid="expense-totals">
          <Flex gap={24} wrap align="center">
            <Statistic
              title={t('vehicles.expenses.total')}
              value={summary.total}
              formatter={() => <Money amount={summary.total} />}
            />
            {summary.paidByUs !== undefined && summary.paidByUs !== summary.total && (
              <Statistic
                title={t('vehicles.expenses.paidByUs')}
                value={summary.paidByUs}
                formatter={() => <Money amount={summary.paidByUs} />}
              />
            )}
            <Flex gap={8} wrap align="center">
              {summary.byCategory.map((c) => (
                <ToneTag
                  key={c.category}
                  tone={toneOf('ExpenseCategory', c.category)}
                  className="rm-expense-total-tag"
                  data-category={c.category}
                >
                  {enumLabel('ExpenseCategory', c.category)} · <Money amount={c.total} />
                </ToneTag>
              ))}
            </Flex>
          </Flex>
        </Card>
      )}

      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DataTable<VehicleExpense>
          data-testid="expenses-table"
          label={t('vehicles.expenses.title')}
          rowKey={(e) => e.id}
          columns={columns}
          data={query.data?.items}
          loading={query.isFetching}
          size="small"
          empty={
            <EmptyState
              compact
              description={filtered ? t('table.emptyFiltered') : t('vehicles.expenses.empty')}
            />
          }
        />
      )}

      {editing && (
        <ExpenseDialog
          vehicleId={vehicleId}
          expense={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
            void message.success(t('common.saved'));
          }}
        />
      )}
      {rebilling && (
        <RebillExpenseDialog
          expense={rebilling}
          onClose={() => setRebilling(null)}
          onSaved={() => {
            setRebilling(null);
            onChanged();
            void message.success(t('vehicles.expenses.rebilled'));
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('vehicles.expenses.deleteTitle')}
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </Flex>
  );
}
