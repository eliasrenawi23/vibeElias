import {
  DepositKind,
  isoDate,
  msg,
  nonNegativeMoney,
  optionalText,
  paymentDay,
  penaltyMonths,
  positiveMoney,
  ResponsibilitiesSchema,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { updateLease, type LeaseUpdateBody } from '../api';
import { ResponsibilitiesField } from '../components/ResponsibilitiesField';
import type { LeaseDetail } from '../types';

const LeaseEditSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    monthlyRent: positiveMoney,
    paymentDay,
    rentIncludesVat: z.boolean(),
    earlyExitPenaltyMonths: penaltyMonths,
    depositAmount: nonNegativeMoney,
    depositKind: DepositKind,
    responsibilities: ResponsibilitiesSchema,
    terms: optionalText(20_000),
    notes: optionalText(5000),
  })
  .superRefine((v, ctx) => {
    if (v.endDate <= v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: msg.endBeforeStart });
    }
  });
type LeaseEditOutput = z.output<typeof LeaseEditSchema>;

/** PATCH body: a DRAFT sends every term; an ACTIVE contract only what may still change. */
export function toLeaseUpdateBody(v: LeaseEditOutput, draft: boolean): LeaseUpdateBody {
  const always: LeaseUpdateBody = {
    endDate: v.endDate,
    paymentDay: v.paymentDay,
    responsibilities: v.responsibilities,
    terms: v.terms ?? null,
    notes: v.notes ?? null,
  };
  if (!draft) return always;
  return {
    ...always,
    startDate: v.startDate,
    monthlyRent: v.monthlyRent,
    rentIncludesVat: v.rentIncludesVat,
    earlyExitPenaltyMonths: v.earlyExitPenaltyMonths,
    depositAmount: v.depositAmount,
    depositKind: v.depositKind,
  };
}

export interface LeaseEditDialogProps {
  lease: LeaseDetail;
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/** Edit the terms: everything while DRAFT; end date, payment day, terms, responsibilities and notes once ACTIVE. */
export function LeaseEditDialog({ lease, onClose, onSaved }: LeaseEditDialogProps) {
  const { t } = useTranslation();
  const draft = lease.status === 'DRAFT';
  const kindOptions = useEnumOptions('DepositKind', DepositKind.options);
  const form = useZodForm(LeaseEditSchema, {
    defaultValues: {
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.currentSegment?.monthlyRent ?? 1,
      paymentDay: lease.paymentDay,
      rentIncludesVat: lease.rentIncludesVat,
      earlyExitPenaltyMonths: Number(lease.earlyExitPenaltyMonths),
      depositAmount: Number(lease.depositAmount),
      depositKind: lease.depositKind,
      responsibilities: lease.responsibilities,
      terms: lease.terms ?? '',
      notes: lease.notes ?? '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError);
  const mutation = useMutation({
    mutationFn: (body: LeaseUpdateBody) => updateLease(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(toLeaseUpdateBody(values, draft));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('leases.edit.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={760}
    >
      {!draft && (
        <Alert
          type="info"
          showIcon
          className="rm-dialog-note"
          title={t('leases.edit.activeHint')}
        />
      )}
      <Row gutter={12}>
        {draft && (
          <Col xs={24} sm={8}>
            <FormDateField
              control={form.control}
              name="startDate"
              label={t('leases.fields.startDate')}
              required
              allowClear={false}
            />
          </Col>
        )}
        <Col xs={24} sm={8}>
          <FormDateField
            control={form.control}
            name="endDate"
            label={t('leases.fields.endDate')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={8}>
          <FormNumberField
            control={form.control}
            name="paymentDay"
            label={t('leases.fields.paymentDay')}
            required
            min={1}
            max={28}
          />
        </Col>
        {draft && (
          <>
            <Col xs={24} sm={8}>
              <FormMoneyField
                control={form.control}
                name="monthlyRent"
                label={t('leases.fields.monthlyRent')}
                required
                min={0}
              />
            </Col>
            <Col xs={24} sm={8}>
              <FormNumberField
                control={form.control}
                name="earlyExitPenaltyMonths"
                label={t('leases.fields.earlyExitPenaltyMonths')}
                min={0}
                max={12}
                precision={2}
                grouping={false}
                unit={t('units.months')}
              />
            </Col>
            <Col xs={24} sm={8} className="rm-checkbox-col">
              <FormCheckboxField
                control={form.control}
                name="rentIncludesVat"
                label={t('leases.fields.rentIncludesVat')}
              />
            </Col>
            <Col xs={24} sm={8}>
              <FormMoneyField
                control={form.control}
                name="depositAmount"
                label={t('leases.fields.depositAmount')}
                min={0}
              />
            </Col>
            <Col xs={24} sm={8}>
              <FormSelect
                control={form.control}
                name="depositKind"
                label={t('leases.fields.depositKind')}
                options={kindOptions}
              />
            </Col>
          </>
        )}
        <Col xs={24}>
          <ResponsibilitiesField control={form.control} name="responsibilities" />
        </Col>
        <Col xs={24} md={12}>
          <FormTextAreaField
            control={form.control}
            name="terms"
            label={t('leases.fields.terms')}
            minRows={3}
          />
        </Col>
        <Col xs={24} md={12}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            minRows={3}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
