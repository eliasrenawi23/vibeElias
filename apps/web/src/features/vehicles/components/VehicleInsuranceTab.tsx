import { PlusOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { App, Button, Flex } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { deleteInsurance } from '../api';
import { InsuranceDialog } from '../dialogs/InsuranceDialog';
import type { InsurancePolicy, VehicleDetail } from '../types';
import { InsuranceTable } from './InsuranceTable';

export interface VehicleInsuranceTabProps {
  vehicle: VehicleDetail;
  /** Called after a policy was added, edited or deleted. */
  onChanged: () => void;
}

/** Vehicle policies (from `GET /vehicles/:id`) with add / edit / delete. */
export function VehicleInsuranceTab({ vehicle, onChanged }: VehicleInsuranceTabProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<InsurancePolicy | 'new' | null>(null);
  const [deleting, setDeleting] = useState<InsurancePolicy | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteInsurance(id),
    onSuccess: () => {
      setDeleting(null);
      onChanged();
      void message.success(t('common.deleted'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });

  return (
    <Flex vertical gap={16}>
      <Flex justify="flex-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
          {t('vehicles.insurance.addTitle')}
        </Button>
      </Flex>
      <InsuranceTable
        data-testid="vehicle-insurance-table"
        policies={vehicle.insurance ?? []}
        showTaxiExtension={vehicle.isTaxi}
        onEdit={setEditing}
        onDelete={setDeleting}
      />
      {editing && (
        <InsuranceDialog
          scope="VEHICLE"
          vehicleId={vehicle.id}
          isTaxi={vehicle.isTaxi}
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
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
