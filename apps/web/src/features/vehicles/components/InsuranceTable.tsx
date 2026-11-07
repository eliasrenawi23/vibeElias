import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Flex, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DataTable, type DataTableColumn } from '../../../shared/ui/DataTable';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ExpiryBadge } from '../../../shared/ui/ExpiryBadge';
import { Money } from '../../../shared/ui/Money';
import type { InsurancePolicy } from '../types';

export interface InsuranceTableProps {
  policies: readonly InsurancePolicy[] | undefined;
  loading?: boolean;
  /** Show the taxi-extension column (vehicle policies of a taxi). */
  showTaxiExtension?: boolean;
  onEdit: (policy: InsurancePolicy) => void;
  onDelete: (policy: InsurancePolicy) => void;
  'data-testid'?: string;
}

/** Insurance policies with expiry badges (red = ended, amber = ends within 30 days). */
export function InsuranceTable({
  policies,
  loading,
  showTaxiExtension = false,
  onEdit,
  onDelete,
  'data-testid': testId,
}: InsuranceTableProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();

  const columns: DataTableColumn<InsurancePolicy>[] = [
    {
      key: 'type',
      title: t('vehicles.insurance.type'),
      mobile: 'title',
      render: (p) => enumLabel('InsuranceType', p.type),
    },
    {
      key: 'insurer',
      title: t('vehicles.insurance.insurer'),
      render: (p) => <AutoDir>{p.insurer}</AutoDir>,
    },
    {
      key: 'policyNo',
      title: t('vehicles.insurance.policyNo'),
      render: (p) => (p.policyNo ? <Ltr>{p.policyNo}</Ltr> : <span className="rm-empty-value">—</span>),
    },
    {
      key: 'start',
      title: t('vehicles.insurance.startDate'),
      render: (p) => <DateText value={p.startDate} />,
    },
    {
      key: 'end',
      title: t('vehicles.insurance.endDate'),
      render: (p) => <ExpiryBadge value={p.endDate} showValid />,
    },
    {
      key: 'premium',
      title: t('vehicles.insurance.premium'),
      align: 'end',
      render: (p) => <Money amount={p.premium} />,
    },
    {
      key: 'paidBy',
      title: t('vehicles.insurance.paidBy'),
      render: (p) => enumLabel('PaidBy', p.paidBy),
    },
    ...(showTaxiExtension
      ? [
          {
            key: 'taxiExt',
            title: t('vehicles.insurance.hasTaxiExtension'),
            render: (p: InsurancePolicy) => (p.hasTaxiExtension ? t('actions.yes') : t('actions.no')),
          },
        ]
      : []),
    {
      key: 'actions',
      title: t('common.actions'),
      align: 'end',
      render: (p) => (
        <Flex gap={4} justify="flex-end">
          <Tooltip title={t('actions.edit')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t('actions.edit')}
              onClick={() => onEdit(p)}
            />
          </Tooltip>
          <Tooltip title={t('actions.delete')}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('actions.delete')}
              onClick={() => onDelete(p)}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <DataTable<InsurancePolicy>
      data-testid={testId}
      label={t('vehicles.insurance.title')}
      rowKey={(p) => p.id}
      columns={columns}
      data={policies}
      loading={loading}
      size="small"
      empty={<EmptyState compact description={t('vehicles.insurance.empty')} />}
    />
  );
}
