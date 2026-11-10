import { OdometerCreateSchema, todayInBusinessTz, type OdometerCreate } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { formatCount } from '../../../shared/lib/money';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { addOdometerReading } from '../api';

export interface OdometerDialogProps {
  vehicleId: string;
  /** Latest known reading, shown as a hint. */
  currentKm?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Add an odometer reading (`POST /vehicles/:id/odometer`; lower than an earlier one -> 400). */
export function OdometerDialog({ vehicleId, currentKm, onClose, onSaved }: OdometerDialogProps) {
  const { t, i18n } = useTranslation();
  const form = useZodForm(OdometerCreateSchema, {
    defaultValues: { km: undefined, date: todayInBusinessTz(), source: '' },
  });
  const { formError, handleError } = useFormErrors(form.setError);

  const mutation = useMutation({
    mutationFn: (body: OdometerCreate) => addOdometerReading(vehicleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      handleError(error);
    }
  });

  const lastHint =
    currentKm !== null && currentKm !== undefined
      ? t('vehicles.odometer.lastReading', {
          km: isolateLtr(`${formatCount(currentKm, i18n.resolvedLanguage)} ${t('units.km')}`),
        })
      : undefined;

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('vehicles.odometer.dialogTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={480}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormNumberField
            control={form.control}
            name="km"
            label={t('vehicles.odometer.km')}
            help={lastHint}
            required
            min={0}
            unit={t('units.km')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="date"
            label={t('vehicles.odometer.date')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24}>
          <FormTextField
            control={form.control}
            name="source"
            label={t('vehicles.odometer.source')}
            help={t('vehicles.odometer.sourceHelp')}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
