import { LedgerPaymentMethod, todayInBusinessTz } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row } from 'antd';
import type { Control, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { Money } from '../../../shared/ui/Money';
import { addCharge, addCredit, recordPayment, voidEntry } from '../api';
import { LedgerTypeTag } from '../components/LedgerTable';
import type { LedgerEntry } from '../types';
import {
  ChargeFormSchema,
  CreditFormSchema,
  defaultContractId,
  MANUAL_CHARGE_KINDS,
  PaymentFormSchema,
  VoidFormSchema,
  type ContractOption,
} from './ledgerForms';

interface EntryDialogProps {
  driverId: string;
  /** Fixed contract (lease page); `undefined` lets the user pick one of `contracts`. */
  contractId?: string | null;
  /** The driver's contracts, offered when `contractId` is not fixed. */
  contracts?: readonly ContractOption[];
  onClose: () => void;
  onSaved: (entry: LedgerEntry) => void;
}

/** Optional "contract" select of the driver-level dialogs. */
function ContractField<T extends FieldValues, TOut>({
  control,
  contracts,
}: {
  control: Control<T, unknown, TOut>;
  contracts: readonly ContractOption[];
}) {
  const { t } = useTranslation();
  return (
    <FormSelect
      control={control}
      name={'contractId' as never}
      label={t('ledger.fields.contract')}
      allowClear
      placeholder={t('ledger.noContract')}
      options={contracts.map((c) => ({
        value: c.id,
        label: t('leases.contractNo', { no: isolateLtr(`#${c.contractNo}`) }),
      }))}
    />
  );
}

/** "Record payment": amount, date, method, reference and notes. */
export function PaymentDialog({
  driverId,
  contractId,
  contracts,
  suggestedAmount,
  onClose,
  onSaved,
}: EntryDialogProps & { suggestedAmount?: number | null }) {
  const { t } = useTranslation();
  const methodOptions = useEnumOptions('PaymentMethod', LedgerPaymentMethod.options);
  const form = useZodForm(PaymentFormSchema, {
    defaultValues: {
      contractId: defaultContractId(contractId, contracts),
      amount: suggestedAmount && suggestedAmount > 0 ? suggestedAmount : undefined,
      date: todayInBusinessTz(),
      method: 'CASH',
      reference: '',
      notes: '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['contractId', 'amount', 'date', 'method', 'reference', 'notes'],
  });
  const mutation = useMutation({ mutationFn: recordPayment, onSuccess: onSaved });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync({
        driverId,
        contractId: v.contractId ?? null,
        amount: v.amount,
        date: v.date,
        method: v.method,
        reference: v.reference ?? null,
        notes: v.notes ?? null,
      });
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={t('ledger.payment.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        {contractId === undefined && contracts && contracts.length > 0 && (
          <Col xs={24}>
            <ContractField control={form.control} contracts={contracts} />
          </Col>
        )}
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
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="method"
            label={t('ledger.fields.method')}
            options={methodOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="reference"
            label={t('ledger.fields.reference')}
            help={t('ledger.payment.referenceHelp')}
            inputProps={{ dir: 'ltr' }}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            maxLength={500}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}

/** "Add charge": damage, fine, insurance, repair, penalty... (not rent). */
export function ChargeDialog({
  driverId,
  contractId,
  contracts,
  onClose,
  onSaved,
}: EntryDialogProps) {
  const { t } = useTranslation();
  const kindOptions = useEnumOptions('ChargeKind', MANUAL_CHARGE_KINDS);
  const form = useZodForm(ChargeFormSchema, {
    defaultValues: {
      contractId: defaultContractId(contractId, contracts),
      chargeKind: 'DAMAGE',
      amount: undefined,
      date: todayInBusinessTz(),
      dueDate: null,
      description: '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['contractId', 'chargeKind', 'amount', 'date', 'dueDate', 'description'],
  });
  const mutation = useMutation({ mutationFn: addCharge, onSuccess: onSaved });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync({
        driverId,
        contractId: v.contractId ?? null,
        chargeKind: v.chargeKind,
        amount: v.amount,
        date: v.date,
        dueDate: v.dueDate ?? null,
        description: v.description ?? null,
      });
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={t('ledger.charge.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        {contractId === undefined && contracts && contracts.length > 0 && (
          <Col xs={24}>
            <ContractField control={form.control} contracts={contracts} />
          </Col>
        )}
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="chargeKind"
            label={t('ledger.fields.chargeKind')}
            options={kindOptions}
            required
          />
        </Col>
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
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="dueDate"
            label={t('ledger.fields.dueDate')}
            help={t('ledger.charge.dueDateHelp')}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="description"
            label={t('ledger.fields.description')}
            maxLength={500}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}

/** "Add credit": lowers the balance (goodwill, unused days, corrections). */
export function CreditDialog({
  driverId,
  contractId,
  contracts,
  onClose,
  onSaved,
}: EntryDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(CreditFormSchema, {
    defaultValues: {
      contractId: defaultContractId(contractId, contracts),
      amount: undefined,
      date: todayInBusinessTz(),
      description: '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['contractId', 'amount', 'date', 'description'],
  });
  const mutation = useMutation({ mutationFn: addCredit, onSuccess: onSaved });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync({
        driverId,
        contractId: v.contractId ?? null,
        amount: v.amount,
        date: v.date,
        description: v.description ?? null,
      });
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={t('ledger.credit.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        {contractId === undefined && contracts && contracts.length > 0 && (
          <Col xs={24}>
            <ContractField control={form.control} contracts={contracts} />
          </Col>
        )}
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
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="description"
            label={t('ledger.fields.description')}
            maxLength={500}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}

/** Void a ledger row with a reason (rows are never edited or deleted). */
export function VoidDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: LedgerEntry;
  onClose: () => void;
  onSaved: (entry: LedgerEntry) => void;
}) {
  const { t } = useTranslation();
  const form = useZodForm(VoidFormSchema, { defaultValues: { reason: '' } });
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['reason'] });
  const mutation = useMutation({
    mutationFn: (reason: string) => voidEntry(entry.id, reason),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v.reason);
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={t('ledger.void.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('ledger.void.action')}
      okDanger
    >
      <Alert
        type="warning"
        showIcon
        className="rm-dialog-note"
        title={
          <span>
            <LedgerTypeTag entry={entry} /> <Money amount={entry.amount} />
          </span>
        }
        description={t('ledger.void.hint')}
      />
      <FormTextAreaField
        control={form.control}
        name="reason"
        label={t('ledger.void.reason')}
        required
        maxLength={500}
      />
    </FormDialog>
  );
}
