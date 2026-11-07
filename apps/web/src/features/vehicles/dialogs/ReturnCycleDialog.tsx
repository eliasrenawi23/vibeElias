import { CycleReturnSchema, todayInBusinessTz, type CycleReturn } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { returnCycle } from '../api';
import type { VehicleDetail } from '../types';

export interface ReturnCycleDialogProps {
  cycleId: string;
  onClose: () => void;
  /** Receives the updated vehicle file returned by the API. */
  onSaved: (vehicle: VehicleDetail) => void;
}

/** End the open consignment cycle: the car goes back to its owner (`POST /cycles/:id/return`). */
export function ReturnCycleDialog({ cycleId, onClose, onSaved }: ReturnCycleDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(CycleReturnSchema, {
    defaultValues: { date: todayInBusinessTz(), note: '' },
  });
  const { formError, handleError } = useFormErrors(form.setError);

  const mutation = useMutation({
    mutationFn: (body: CycleReturn) => returnCycle(cycleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async ({ date, note }) => {
    try {
      await mutation.mutateAsync({ date, note });
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      title={t('vehicles.cycles.returnTitle')}
      okText={t('vehicles.actions.returnToConsignor')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={480}
    >
      <Alert
        type="warning"
        showIcon
        title={t('vehicles.cycles.returnConfirm')}
        className="rm-dialog-note"
      />
      <Row gutter={12}>
        <Col xs={24}>
          <FormDateField
            control={form.control}
            name="date"
            label={t('vehicles.cycles.returnDate')}
            allowClear={false}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="note"
            label={t('vehicles.cycles.returnNote')}
            maxLength={1000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
