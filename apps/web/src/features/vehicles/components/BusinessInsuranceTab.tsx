import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Flex, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { FilterBar } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { deleteInsurance, fetchBusinessInsurance } from '../api';
import { InsuranceDialog } from '../dialogs/InsuranceDialog';
import { insuranceKeys } from '../queryKeys';
import type { InsurancePolicy } from '../types';
import { InsuranceTable } from './InsuranceTable';

/** Business-level policies (trade / lot) with add, edit and delete. */
export function BusinessInsuranceTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const [params] = useSearchParams();
  const activeOnly = params.get('activeOnly') === '1';
  const [editing, setEditing] = useState<InsurancePolicy | 'new' | null>(null);
  const [deleting, setDeleting] = useState<InsurancePolicy | null>(null);

  const query = useQuery({
    queryKey: insuranceKeys.business(activeOnly),
    queryFn: ({ signal }) => fetchBusinessInsurance(activeOnly, signal),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: insuranceKeys.all });

  const remove = useMutation({
    mutationFn: (id: string) => deleteInsurance(id),
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
      void message.success(t('common.deleted'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  return (
    <Flex vertical gap={16}>
      <Typography.Text type="secondary">{t('vehicles.insurance.businessHint')}</Typography.Text>
      <FilterBar
        searchKey={null}
        filters={[{ type: 'toggle', key: 'activeOnly', label: t('vehicles.insurance.activeOnly') }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            {t('vehicles.insurance.addTitle')}
          </Button>
        }
      />
      {query.isError ? (
        <LoadError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <InsuranceTable
          data-testid="business-insurance-table"
          policies={query.data}
          loading={query.isFetching}
          onEdit={setEditing}
          onDelete={setDeleting}
        />
      )}
      {editing && (
        <InsuranceDialog
          scope="BUSINESS"
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
            void message.success(t('common.saved'));
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('vehicles.insurance.deleteTitle')}
        confirmText={t('actions.delete')}
        danger
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </Flex>
  );
}
