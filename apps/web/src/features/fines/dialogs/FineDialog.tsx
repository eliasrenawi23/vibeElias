import {
  idString,
  isoDate,
  isoDateTime,
  optionalText,
  positiveMoney,
  todayInBusinessTz,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import { useId } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FieldShell } from '../../../shared/ui/FieldShell';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDateTimeField } from '../../../shared/ui/FormDateTimeField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { VehiclePicker } from '../../vehicles/components/VehiclePicker';
import { createFine, type FineCreateBody } from '../api';
import type { TrafficFine } from '../types';

const FineFormSchema = z.object({
  vehicleId: idString,
  offenceAt: isoDateTime,
  receivedAt: isoDate,
  amount: positiveMoney,
  fineNo: optionalText(50),
  authority: optionalText(100),
  notes: optionalText(2000),
});

export interface FineDialogProps {
  /** Preselected vehicle (vehicle page). */
  vehicleId?: string;
  onClose: () => void;
  onSaved: (fine: TrafficFine) => void;
}

/** Record a traffic fine; the API matches the driver who had the car at the offence. */
export function FineDialog({ vehicleId, onClose, onSaved }: FineDialogProps) {
  const { t } = useTranslation();
  const pickerId = useId();
  const form = useZodForm(FineFormSchema, {
    defaultValues: {
      vehicleId: vehicleId ?? '',
      offenceAt: undefined,
      receivedAt: todayInBusinessTz(),
      amount: undefined,
      fineNo: '',
      authority: '',
      notes: '',
    },
  });
  const { field, fieldState } = useController({ control: form.control, name: 'vehicleId' });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['vehicleId', 'offenceAt', 'receivedAt', 'amount', 'fineNo', 'authority', 'notes'],
  });
  const mutation = useMutation({ mutationFn: createFine, onSuccess: onSaved });
  const submit = form.handleSubmit(async (v) => {
    const body: FineCreateBody = {
      vehicleId: v.vehicleId,
      offenceAt: v.offenceAt,
      receivedAt: v.receivedAt,
      amount: v.amount,
      fineNo: v.fineNo ?? null,
      authority: v.authority ?? null,
      notes: v.notes ?? null,
    };
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
      title={t('fines.addTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={640}
    >
      <Alert type="info" showIcon className="rm-dialog-note" title={t('fines.matchHint')} />
      <Row gutter={12}>
        <Col xs={24}>
          <FieldShell
            id={pickerId}
            label={t('fines.fields.vehicle')}
            required
            error={fieldState.error}
          >
            <VehiclePicker
              id={pickerId}
              value={field.value || null}
              onChange={(id) => field.onChange(id ?? '')}
              onBlur={field.onBlur}
              status={fieldState.error ? 'error' : undefined}
              aria-label={t('fines.fields.vehicle')}
              data-testid="fine-vehicle"
            />
          </FieldShell>
        </Col>
        <Col xs={24} sm={12}>
          <FormDateTimeField
            control={form.control}
            name="offenceAt"
            label={t('fines.fields.offenceAt')}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="receivedAt"
            label={t('fines.fields.receivedAt')}
            required
            allowClear={false}
            help={t('fines.receivedHelp')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="amount"
            label={t('fines.fields.amount')}
            required
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="fineNo"
            label={t('fines.fields.fineNo')}
            inputProps={{ dir: 'ltr', spellCheck: false }}
          />
        </Col>
        <Col xs={24}>
          <FormTextField
            control={form.control}
            name="authority"
            label={t('fines.fields.authority')}
            help={t('fines.authorityHelp')}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            maxLength={2000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
