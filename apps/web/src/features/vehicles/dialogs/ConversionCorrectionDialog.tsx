import { VehicleConversionUpdateSchema, type VehicleConversionUpdate } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { displayPlate, normalizePlate } from '../../../shared/lib/plate';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormPlateField } from '../../../shared/ui/FormPlateField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { updateConversion } from '../api';
import type { PlateChange, VehicleDetail } from '../types';

export interface ConversionCorrectionDialogProps {
  vehicleId: string;
  /** The conversion being corrected (the latest taxi -> private plate change). */
  change: PlateChange;
  onClose: () => void;
  onSaved: (vehicle: VehicleDetail) => void;
}

const FIELDS = ['convertedAt', 'newPlateNo', 'conversionTax', 'notes'];

/** Fix a typo in the conversion (`PATCH /vehicles/:id/conversion`): only changed fields are sent. */
export function ConversionCorrectionDialog({
  vehicleId,
  change,
  onClose,
  onSaved,
}: ConversionCorrectionDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(VehicleConversionUpdateSchema, {
    defaultValues: {
      convertedAt: change.changedAt,
      newPlateNo: displayPlate(change.newPlateNo),
      conversionTax: change.conversionTax ?? 0,
      notes: change.notes ?? '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, { fields: FIELDS });

  const mutation = useMutation({
    mutationFn: (body: VehicleConversionUpdate) => updateConversion(vehicleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    const body: VehicleConversionUpdate = {};
    if (values.convertedAt && values.convertedAt !== change.changedAt) {
      body.convertedAt = values.convertedAt;
    }
    if (values.newPlateNo && normalizePlate(values.newPlateNo) !== change.newPlateNo) {
      body.newPlateNo = values.newPlateNo;
    }
    if (
      values.conversionTax !== undefined &&
      values.conversionTax !== (change.conversionTax ?? 0)
    ) {
      body.conversionTax = values.conversionTax;
    }
    if ((values.notes ?? null) !== (change.notes ?? null)) body.notes = values.notes ?? null;
    try {
      await mutation.mutateAsync(body);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('vehicles.convert.correctTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={560}
    >
      <div data-testid="conversion-correction-dialog">
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <FormDateField
              control={form.control}
              name="convertedAt"
              label={t('vehicles.convert.date')}
              required
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormPlateField
              control={form.control}
              name="newPlateNo"
              label={t('vehicles.convert.newPlate')}
              required
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormMoneyField
              control={form.control}
              name="conversionTax"
              label={t('vehicles.convert.customs')}
              required
              min={0}
              precision={0}
            />
          </Col>
          <Col xs={24}>
            <FormTextAreaField
              control={form.control}
              name="notes"
              label={t('vehicles.convert.notes')}
              maxLength={1000}
            />
          </Col>
        </Row>
      </div>
    </FormDialog>
  );
}
