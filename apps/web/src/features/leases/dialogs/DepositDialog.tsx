import {
  DepositAction,
  isoDate,
  LedgerPaymentMethod,
  optionalText,
  positiveMoney,
  todayInBusinessTz,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Col, Form, Radio, Row, Typography } from 'antd';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { Money } from '../../../shared/ui/Money';
import { depositAction, type LeaseDepositBody } from '../api';
import { methodForDepositKind } from '../lib/leaseRules';
import type { LeaseDetail } from '../types';

const DepositFormSchema = z.object({
  action: DepositAction,
  amount: positiveMoney,
  method: LedgerPaymentMethod.nullish(),
  reference: optionalText(100),
  date: isoDate,
  note: optionalText(500),
});

/** Default amount per action: what is still missing (IN) or what is held (OUT / APPLY). */
export function defaultDepositAmount(
  action: DepositAction,
  expected: number,
  held: number,
): number | null {
  const agorot =
    action === 'IN' ? Math.round(expected * 100) - Math.round(held * 100) : Math.round(held * 100);
  return agorot > 0 ? agorot / 100 : null;
}

export interface DepositDialogProps {
  lease: LeaseDetail;
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/** Receive, return or apply the deposit (apply = offset against open debt). */
export function DepositDialog({ lease, onClose, onSaved }: DepositDialogProps) {
  const { t } = useTranslation();
  const methodOptions = useEnumOptions('PaymentMethod', LedgerPaymentMethod.options);
  const held = lease.balance?.depositHeld ?? 0;
  const initial: DepositAction = held < lease.depositAmount || held <= 0 ? 'IN' : 'OUT';
  const form = useZodForm(DepositFormSchema, {
    defaultValues: {
      action: initial,
      amount: defaultDepositAmount(initial, lease.depositAmount, held) ?? undefined,
      method: methodForDepositKind(lease.depositKind),
      reference: '',
      date: todayInBusinessTz(),
      note: '',
    },
  });
  const action = useWatch({ control: form.control, name: 'action' });
  const { field: actionField } = useController({ control: form.control, name: 'action' });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['action', 'amount', 'method', 'reference', 'date', 'note'],
  });
  const mutation = useMutation({
    mutationFn: (body: LeaseDepositBody) => depositAction(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    const moves = v.action !== 'APPLY';
    try {
      await mutation.mutateAsync({
        action: v.action,
        amount: v.amount,
        ...(moves ? { method: v.method ?? 'CASH', reference: v.reference ?? null } : {}),
        date: v.date,
        note: v.note ?? null,
      });
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      title={t('leases.deposit.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Typography.Paragraph>
        {t('ledger.fields.depositHeld')}: <Money amount={held} /> ·{' '}
        {t('leases.fields.depositAmount')}: <Money amount={lease.depositAmount} />
      </Typography.Paragraph>
      <Form.Item label={t('leases.deposit.action')} required>
        <Radio.Group
          value={actionField.value}
          optionType="button"
          buttonStyle="solid"
          onChange={(e) => {
            const next = e.target.value as DepositAction;
            actionField.onChange(next);
            const amount = defaultDepositAmount(next, lease.depositAmount, held);
            if (amount !== null) form.setValue('amount', amount);
          }}
          options={DepositAction.options.map((a) => ({
            value: a,
            label: t(`enums.DepositAction.${a}`),
            disabled: a !== 'IN' && held <= 0,
          }))}
          data-testid="deposit-action"
        />
      </Form.Item>
      {action === 'APPLY' && (
        <Typography.Paragraph type="secondary">
          {t('leases.deposit.applyHint')}
        </Typography.Paragraph>
      )}
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="amount"
            label={t('ledger.fields.amount')}
            required
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="date"
            label={t('ledger.fields.date')}
            required
            allowClear={false}
          />
        </Col>
        {action !== 'APPLY' && (
          <>
            <Col xs={24} sm={12}>
              <FormSelect
                control={form.control}
                name="method"
                label={t('ledger.fields.method')}
                options={methodOptions}
              />
            </Col>
            <Col xs={24} sm={12}>
              <FormTextField
                control={form.control}
                name="reference"
                label={t('ledger.fields.reference')}
                inputProps={{ dir: 'ltr' }}
              />
            </Col>
          </>
        )}
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="note"
            label={t('common.notes')}
            maxLength={500}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
