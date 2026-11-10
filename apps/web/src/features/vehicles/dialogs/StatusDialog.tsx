import {
  VehicleStatusChangeSchema,
  type VehicleStatus,
  type VehicleStatusChange,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormRadioField } from '../../../shared/ui/FormRadioField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { StatusTag } from '../../../shared/ui/StatusTag';
import { changeVehicleStatus } from '../api';
import { allowedStatusTargets } from '../lib/vehicleRules';
import type { VehicleDetail } from '../types';

export interface StatusDialogProps {
  vehicleId: string;
  /** Current status: decides which targets are offered. */
  status: VehicleStatus;
  onClose: () => void;
  /** Receives the updated vehicle file returned by the API. */
  onSaved: (vehicle: VehicleDetail) => void;
}

/**
 * Manual status change (`POST /vehicles/:id/status`): only the transitions the API allows from
 * the current status are offered; sales and leases change the status through their own flows.
 */
export function StatusDialog({ vehicleId, status, onClose, onSaved }: StatusDialogProps) {
  const { t } = useTranslation();
  const targets = allowedStatusTargets(status);
  const options = useEnumOptions('VehicleStatus', targets);
  const form = useZodForm(VehicleStatusChangeSchema, {
    defaultValues: { status: targets[0], note: '' },
  });
  const { formError, handleError } = useFormErrors(form.setError);

  const mutation = useMutation({
    mutationFn: (body: VehicleStatusChange) => changeVehicleStatus(vehicleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('vehicles.status.dialogTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      okDisabled={targets.length === 0}
      error={formError}
    >
      <Flex vertical gap={12} data-testid="status-dialog">
        <Flex gap={8} align="center" wrap>
          <Typography.Text type="secondary">{t('vehicles.status.current')}</Typography.Text>
          <StatusTag enumName="VehicleStatus" value={status} />
        </Flex>
        {targets.length === 0 ? (
          <Alert
            type="info"
            showIcon
            title={t('vehicles.status.noTargets')}
            data-testid="status-no-targets"
          />
        ) : (
          <>
            <FormRadioField
              control={form.control}
              name="status"
              label={t('vehicles.status.newStatus')}
              options={options}
              required
              vertical
            />
            <FormTextAreaField
              control={form.control}
              name="note"
              label={t('vehicles.status.note')}
              maxLength={500}
            />
          </>
        )}
        <Typography.Text type="secondary">{t('vehicles.status.saleHint')}</Typography.Text>
      </Flex>
    </FormDialog>
  );
}
