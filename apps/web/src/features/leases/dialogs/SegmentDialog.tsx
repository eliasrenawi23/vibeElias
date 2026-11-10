import {
  idString,
  isoDate,
  msg,
  positiveMoney,
  requiredText,
  todayInBusinessTz,
} from '@renawi/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Col, Row, Select } from 'antd';
import { useId } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FieldShell } from '../../../shared/ui/FieldShell';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { fetchTaxiLicenses } from '../../taxi-licenses/api';
import { availableLicenses } from '../../taxi-licenses/lib/licenseRules';
import { taxiLicenseKeys } from '../../taxi-licenses/queryKeys';
import { VehiclePicker } from '../../vehicles/components/VehiclePicker';
import { addSegment, type LeaseSegmentBody } from '../api';
import type { LeaseDetail } from '../types';

const SegmentFormSchema = z.object({
  startDate: isoDate,
  taxiLicenseId: idString,
  vehicleId: idString.nullish(),
  monthlyRent: positiveMoney,
  reason: requiredText(500),
});
type SegmentFormOutput = z.output<typeof SegmentFormSchema>;

/** Only what changed goes to `POST /leases/:id/segments`; null when nothing changed. */
export function toSegmentBody(v: SegmentFormOutput, lease: LeaseDetail): LeaseSegmentBody | null {
  const seg = lease.currentSegment;
  const body: LeaseSegmentBody = { startDate: v.startDate, reason: v.reason };
  if (v.taxiLicenseId !== seg?.taxiLicense.id) body.taxiLicenseId = v.taxiLicenseId;
  if ((v.vehicleId ?? null) !== (seg?.vehicle?.id ?? null)) body.vehicleId = v.vehicleId ?? null;
  if (Number(v.monthlyRent) !== Number(seg?.monthlyRent)) body.monthlyRent = v.monthlyRent;
  const changed = 'taxiLicenseId' in body || 'vehicleId' in body || 'monthlyRent' in body;
  return changed ? body : null;
}

export interface SegmentDialogProps {
  lease: LeaseDetail;
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/** Swap the car, move to another licence and / or change the rent from a date. */
export function SegmentDialog({ lease, onClose, onSaved }: SegmentDialogProps) {
  const { t } = useTranslation();
  const licenseId = useId();
  const vehicleId = useId();
  const seg = lease.currentSegment;
  const form = useZodForm(SegmentFormSchema, {
    defaultValues: {
      startDate: todayInBusinessTz(),
      taxiLicenseId: seg?.taxiLicense.id ?? '',
      vehicleId: seg?.vehicle?.id ?? null,
      monthlyRent: seg?.monthlyRent,
      reason: '',
    },
  });
  const { field: licenseField, fieldState: licenseState } = useController({
    control: form.control,
    name: 'taxiLicenseId',
  });
  const { field: vehicleField, fieldState: vehicleState } = useController({
    control: form.control,
    name: 'vehicleId',
  });
  const licenses = useQuery({
    queryKey: taxiLicenseKeys.available(),
    queryFn: ({ signal }) => fetchTaxiLicenses({ status: 'ACTIVE', pageSize: 200 }, signal),
  });
  const licenseOptions = [
    ...(seg ? [{ value: seg.taxiLicense.id, label: seg.taxiLicense.licenseNo }] : []),
    ...availableLicenses(licenses.data?.items ?? [])
      .filter((l) => l.id !== seg?.taxiLicense.id)
      .map((l) => ({ value: l.id, label: l.licenseNo })),
  ];

  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['startDate', 'taxiLicenseId', 'vehicleId', 'monthlyRent', 'reason'],
  });
  const mutation = useMutation({
    mutationFn: (body: LeaseSegmentBody) => addSegment(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    const body = toSegmentBody(values, lease);
    if (!body) {
      form.setError('monthlyRent', { type: 'manual', message: msg.nothingToChange });
      return;
    }
    try {
      await mutation.mutateAsync(body);
    } catch (error) {
      handleError(error);
    }
  });

  const carAndNumber = lease.type === 'CAR_AND_NUMBER';
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('leases.segment.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={640}
    >
      <Alert type="info" showIcon className="rm-dialog-note" title={t('leases.segment.hint')} />
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="startDate"
            label={t('leases.segment.from')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="monthlyRent"
            label={t('leases.fields.monthlyRent')}
            required
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FieldShell
            id={licenseId}
            label={t('leases.fields.license')}
            required
            error={licenseState.error}
          >
            <Select
              id={licenseId}
              value={licenseField.value || undefined}
              onChange={(v: string) => licenseField.onChange(v)}
              options={licenseOptions}
              loading={licenses.isFetching}
              labelRender={(p) => <bdi dir="ltr">{String(p.label ?? '')}</bdi>}
              data-testid="segment-license"
            />
          </FieldShell>
        </Col>
        <Col xs={24} sm={12}>
          <FieldShell
            id={vehicleId}
            label={t('leases.fields.vehicle')}
            required={carAndNumber}
            help={carAndNumber ? undefined : t('leases.segment.ownCarHelp')}
            error={vehicleState.error}
          >
            <VehiclePicker
              id={vehicleId}
              value={vehicleField.value ?? null}
              onChange={(v) => vehicleField.onChange(v)}
              filters={
                carAndNumber
                  ? { isTaxi: true, status: 'IN_STOCK', ownership: 'OWNED' }
                  : { ownership: 'THIRD_PARTY' }
              }
              isDisabled={(v) => v.alerts?.includes('taxiAgeBlocked') ?? false}
              allowClear={!carAndNumber}
              data-testid="segment-vehicle"
            />
          </FieldShell>
        </Col>
        <Col xs={24}>
          <FormTextField
            control={form.control}
            name="reason"
            label={t('leases.fields.segmentReason')}
            required
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
