import { addDays, isoDate, msg, paymentDay, positiveMoney } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { renewLease, type LeaseRenewBody } from '../api';
import { defaultEndDate } from '../lib/leaseRules';
import type { LeaseDetail } from '../types';

const RenewFormSchema = z
  .object({ startDate: isoDate, endDate: isoDate, monthlyRent: positiveMoney, paymentDay })
  .superRefine((v, ctx) => {
    if (v.endDate <= v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: msg.endBeforeStart });
    }
  });

export interface RenewDialogProps {
  lease: LeaseDetail;
  onClose: () => void;
  /** The NEW contract. */
  onSaved: (lease: LeaseDetail) => void;
}

/** Renew: the contract ends as RENEWED and a successor starts the next day (deposit carries over). */
export function RenewDialog({ lease, onClose, onSaved }: RenewDialogProps) {
  const { t } = useTranslation();
  const start = addDays(lease.endDate, 1);
  const form = useZodForm(RenewFormSchema, {
    defaultValues: {
      startDate: start,
      endDate: defaultEndDate(start),
      monthlyRent: lease.currentSegment?.monthlyRent,
      paymentDay: lease.paymentDay,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['startDate', 'endDate', 'monthlyRent', 'paymentDay'],
  });
  const mutation = useMutation({
    mutationFn: (body: LeaseRenewBody) => renewLease(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync({
        startDate: v.startDate,
        endDate: v.endDate,
        monthlyRent: v.monthlyRent,
        paymentDay: v.paymentDay,
      });
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('leases.renew.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('leases.renew.submit')}
    >
      <Alert type="info" showIcon className="rm-dialog-note" title={t('leases.renew.hint')} />
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="startDate"
            label={t('leases.fields.startDate')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="endDate"
            label={t('leases.fields.endDate')}
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
          <FormNumberField
            control={form.control}
            name="paymentDay"
            label={t('leases.fields.paymentDay')}
            required
            min={1}
            max={28}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
