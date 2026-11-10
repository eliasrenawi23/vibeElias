import { CommissionMode, ConsignSchema, todayInBusinessTz, type Consign } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useWatch } from 'react-hook-form';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormRadioField } from '../../../shared/ui/FormRadioField';
import { FormContactField } from '../../contacts/components/FormContactField';
import { consignVehicle } from '../api';
import type { VehicleDetail } from '../types';

export interface ConsignDialogProps {
  vehicleId: string;
  /** Suggested asking price (the current listing price). */
  listingPrice?: number | null;
  onClose: () => void;
  /** Receives the updated vehicle file returned by the API. */
  onSaved: (vehicle: VehicleDetail) => void;
}

/**
 * Take a car on consignment (`POST /vehicles/:id/consign`): consignor, asking price and the
 * commission rule (fixed amount, percentage, or the surplus over a minimum net).
 */
export function ConsignDialog({ vehicleId, listingPrice, onClose, onSaved }: ConsignDialogProps) {
  const { t } = useTranslation();
  const modeOptions = useEnumOptions('CommissionMode', CommissionMode.options);
  const form = useZodForm(ConsignSchema, {
    defaultValues: {
      consignorId: undefined,
      startedAt: todayInBusinessTz(),
      askingPrice: listingPrice ?? undefined,
      minNetToConsignor: null,
      commissionMode: 'FIXED',
      commissionValue: null,
      agreementEndsAt: null,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError);
  const mode = useWatch({ control: form.control, name: 'commissionMode' });

  const mutation = useMutation({
    mutationFn: (body: Consign) => consignVehicle(vehicleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(
        values.commissionMode === 'SURPLUS' ? { ...values, commissionValue: null } : values,
      );
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('vehicles.cycles.consignTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={640}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormContactField
            control={form.control}
            name="consignorId"
            label={t('vehicles.cycles.consignor')}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="startedAt"
            label={t('vehicles.cycles.startedAt')}
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="askingPrice"
            label={t('vehicles.cycles.askingPrice')}
            required
            min={0}
            precision={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="agreementEndsAt"
            label={t('vehicles.cycles.agreementEndsAt')}
          />
        </Col>
        <Col xs={24}>
          <FormRadioField
            control={form.control}
            name="commissionMode"
            label={t('vehicles.cycles.commissionMode')}
            options={modeOptions}
            optionType="button"
            required
            help={mode === 'SURPLUS' ? t('vehicles.cycles.surplusHint') : undefined}
          />
        </Col>
        {mode !== 'SURPLUS' && (
          <Col xs={24} sm={12}>
            <FormMoneyField
              control={form.control}
              name="commissionValue"
              label={
                mode === 'PERCENT'
                  ? t('vehicles.cycles.commissionPercent')
                  : t('vehicles.cycles.commissionValue')
              }
              required
              min={0}
              max={mode === 'PERCENT' ? 100 : undefined}
              unit={mode === 'PERCENT' ? t('units.percent') : undefined}
            />
          </Col>
        )}
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="minNetToConsignor"
            label={t('vehicles.cycles.minNetToConsignor')}
            required={mode === 'SURPLUS'}
            min={0}
            precision={0}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
