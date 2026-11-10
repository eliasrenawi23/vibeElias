import {
  isoDate,
  LedgerPaymentMethod,
  nonNegativeMoney,
  optionalIsoDate,
  optionalText,
  todayInBusinessTz,
  type DepositKind,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { businessDateToInstant } from '../../../shared/lib/dates';
import { useEnumLabel, useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { activateLease, type LeaseActivateBody } from '../api';
import { methodForDepositKind } from '../lib/leaseRules';
import type { LeaseDetail } from '../types';

const ActivateFormSchema = z.object({
  signedDate: optionalIsoDate,
  depositAmount: nonNegativeMoney.nullish(),
  depositMethod: LedgerPaymentMethod,
  depositReference: optionalText(100),
  depositDate: isoDate,
});
type ActivateFormOutput = z.output<typeof ActivateFormSchema>;

/** Form values to the activation body: no `deposit` when no amount was received. */
export function toActivateBody(v: ActivateFormOutput): LeaseActivateBody {
  const amount = v.depositAmount ?? 0;
  return {
    ...(v.signedDate ? { signedAt: businessDateToInstant(v.signedDate) } : {}),
    ...(amount > 0
      ? {
          deposit: {
            amount,
            method: v.depositMethod,
            reference: v.depositReference ?? null,
            date: v.depositDate,
          },
        }
      : {}),
  };
}

export interface ActivateDialogProps {
  lease: { id: string; depositAmount: number; depositKind: DepositKind; startDate: string };
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/**
 * Activate a DRAFT: the contract becomes ACTIVE, the first rent charges are generated and the
 * deposit received is recorded (with a receipt).
 */
export function ActivateDialog({ lease, onClose, onSaved }: ActivateDialogProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const methodOptions = useEnumOptions('PaymentMethod', LedgerPaymentMethod.options);
  const today = todayInBusinessTz();
  const form = useZodForm(ActivateFormSchema, {
    defaultValues: {
      signedDate: today,
      depositAmount: lease.depositAmount > 0 ? lease.depositAmount : null,
      depositMethod: methodForDepositKind(lease.depositKind),
      depositReference: '',
      depositDate: today,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['signedDate', 'depositAmount', 'depositMethod', 'depositReference', 'depositDate'],
  });
  const mutation = useMutation({
    mutationFn: (body: LeaseActivateBody) => activateLease(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(toActivateBody(values));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('leases.activate.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('leases.activate.submit')}
    >
      <Alert type="info" showIcon className="rm-dialog-note" title={t('leases.activate.hint')} />
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="signedDate"
            label={t('leases.fields.signedAt')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="depositAmount"
            label={t('leases.activate.depositReceived')}
            help={t('leases.activate.depositHelp', {
              kind: enumLabel('DepositKind', lease.depositKind),
            })}
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="depositMethod"
            label={t('ledger.fields.method')}
            options={methodOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="depositReference"
            label={t('ledger.fields.reference')}
            inputProps={{ dir: 'ltr' }}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="depositDate"
            label={t('leases.activate.depositDate')}
            required
            allowClear={false}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
