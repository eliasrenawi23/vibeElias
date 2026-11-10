import {
  createReturnChecklist,
  isoDate,
  LeaseEndReason,
  LedgerPaymentMethod,
  optionalText,
  ReturnChecklistSchema,
  todayInBusinessTz,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Card, Col, Flex, Form, Radio, Row, Switch, Typography } from 'antd';
import { useController, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { formatAmount } from '../../../shared/lib/money';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { Money } from '../../../shared/ui/Money';
import { endLease, type EndDepositAction, type LeaseEndBody } from '../api';
import { ChecklistFields } from '../components/ChecklistFields';
import { computePenalty, isEarlyExit } from '../lib/leaseRules';
import type { LeaseDetail } from '../types';

const END_REASONS = LeaseEndReason.options.filter(
  (r): r is Exclude<LeaseEndReason, 'RENEWED'> => r !== 'RENEWED',
);
const DEPOSIT_ACTIONS = ['HOLD', 'RETURN', 'APPLY'] as const satisfies readonly EndDepositAction[];

export const EndLeaseFormSchema = z.object({
  actualEndDate: isoDate,
  reason: LeaseEndReason.exclude(['RENEWED']),
  applyPenalty: z.boolean(),
  depositAction: z.enum(DEPOSIT_ACTIONS),
  depositMethod: LedgerPaymentMethod.nullish(),
  note: optionalText(2000),
  returnChecklist: ReturnChecklistSchema,
});
type EndLeaseFormOutput = z.output<typeof EndLeaseFormSchema>;

export interface EndLeaseDialogProps {
  lease: LeaseDetail;
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/** Form values to `POST /leases/:id/end` (the return checklist only when we take our car back). */
export function toEndLeaseBody(v: EndLeaseFormOutput, withChecklist: boolean): LeaseEndBody {
  return {
    actualEndDate: v.actualEndDate,
    reason: v.reason,
    applyPenalty: v.applyPenalty,
    depositAction: v.depositAction,
    ...(v.depositAction === 'RETURN' ? { depositMethod: v.depositMethod ?? 'CASH' } : {}),
    note: v.note ?? null,
    ...(withChecklist ? { returnChecklist: v.returnChecklist } : {}),
  };
}

/**
 * End a contract: last day, reason, optional early-exit penalty (shown computed), what happens
 * to the deposit held, and the return checklist of the car.
 */
export function EndLeaseDialog({ lease, onClose, onSaved }: EndLeaseDialogProps) {
  const { t, i18n } = useTranslation();
  const reasonOptions = useEnumOptions('LeaseEndReason', END_REASONS);
  const methodOptions = useEnumOptions('PaymentMethod', LedgerPaymentMethod.options);
  const today = todayInBusinessTz();
  const rent = lease.currentSegment?.monthlyRent ?? 0;
  const held = lease.balance?.depositHeld ?? 0;
  const withChecklist = lease.type === 'CAR_AND_NUMBER';

  const form = useZodForm(EndLeaseFormSchema, {
    defaultValues: {
      actualEndDate: today < lease.endDate ? today : lease.endDate,
      reason: isEarlyExit(today, lease.endDate) ? 'TERMINATED_BY_DRIVER' : 'EXPIRED',
      applyPenalty: false,
      depositAction: 'HOLD',
      depositMethod: 'CASH',
      note: '',
      returnChecklist: { ...createReturnChecklist(), date: today },
    },
  });
  const actualEndDate = useWatch({ control: form.control, name: 'actualEndDate' });
  const depositActionValue = useWatch({ control: form.control, name: 'depositAction' });
  const { field: penaltyField } = useController({ control: form.control, name: 'applyPenalty' });
  const { field: depositField } = useController({ control: form.control, name: 'depositAction' });
  const early = isEarlyExit(actualEndDate, lease.endDate);
  const penalty = computePenalty(lease.earlyExitPenaltyMonths, rent);

  const { formError, handleError } = useFormErrors(form.setError, {
    fields: [
      'actualEndDate',
      'reason',
      'applyPenalty',
      'depositAction',
      'depositMethod',
      'note',
      'returnChecklist',
    ],
  });
  const mutation = useMutation({
    mutationFn: (body: LeaseEndBody) => endLease(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(toEndLeaseBody(values, withChecklist));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('leases.end.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('leases.end.submit')}
      okDanger
      width={760}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="actualEndDate"
            label={t('leases.fields.actualEndDate')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="reason"
            label={t('leases.fields.endReason')}
            options={reasonOptions}
            required
          />
        </Col>
      </Row>
      {early && (
        <Alert
          type="warning"
          showIcon
          className="rm-dialog-note"
          title={t('leases.end.earlyHint')}
        />
      )}
      <Form.Item label={t('leases.end.penalty')}>
        <Flex gap={12} align="center" wrap>
          <Switch
            checked={Boolean(penaltyField.value)}
            onChange={(on) => penaltyField.onChange(on)}
            aria-label={t('leases.end.applyPenalty')}
            data-testid="end-apply-penalty"
          />
          <span>{t('leases.end.applyPenalty')}</span>
          <Typography.Text
            strong={Boolean(penaltyField.value)}
            type={penaltyField.value ? undefined : 'secondary'}
            data-testid="end-penalty"
            data-applied={Boolean(penaltyField.value)}
          >
            <Money amount={penalty} />{' '}
            <Typography.Text type="secondary">
              (
              {t('leases.end.penaltyFormula', {
                months: isolateLtr(String(Number(lease.earlyExitPenaltyMonths))),
                rent: isolateLtr(formatAmount(rent, i18n.resolvedLanguage)),
              })}
              )
            </Typography.Text>
          </Typography.Text>
        </Flex>
      </Form.Item>
      <Form.Item
        label={
          <span>
            {t('leases.end.deposit')} · {t('ledger.fields.depositHeld')}: <Money amount={held} />
          </span>
        }
      >
        <Radio.Group
          value={depositField.value}
          onChange={(e) => depositField.onChange(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          disabled={held <= 0}
          options={DEPOSIT_ACTIONS.map((a) => ({
            value: a,
            label: t(`leases.end.depositActions.${a}`),
          }))}
          data-testid="end-deposit-action"
        />
      </Form.Item>
      {depositActionValue === 'RETURN' && held > 0 && (
        <FormSelect
          control={form.control}
          name="depositMethod"
          label={t('ledger.fields.method')}
          options={methodOptions}
        />
      )}
      <FormTextAreaField
        control={form.control}
        name="note"
        label={t('common.notes')}
        maxLength={2000}
      />
      {withChecklist && (
        <Card size="small" variant="outlined" title={t('checklist.returnTitle')}>
          <ChecklistFields control={form.control} prefix="returnChecklist" kind="return" />
        </Card>
      )}
    </FormDialog>
  );
}
