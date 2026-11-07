import {
  ExpenseCategory,
  ExpenseCreateSchema,
  PaidBy,
  todayInBusinessTz,
  type ExpenseCreate,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormContactField } from '../../contacts/components/FormContactField';
import { createExpense, updateExpense } from '../api';
import type { VehicleExpense } from '../types';

/** Inputs of the dialog; API errors on other paths (e.g. `cycleId`) go to the alert. */
const EXPENSE_FIELDS = [
  'category',
  'date',
  'amount',
  'vatIncluded',
  'vatReclaimable',
  'paidBy',
  'vendorId',
  'description',
] as const;

export interface ExpenseDialogProps {
  vehicleId: string;
  /** Expense being edited; omitted to add one. */
  expense?: VehicleExpense | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add / edit a vehicle expense. New expenses are linked by the API to the vehicle's open
 * inventory cycle, so the cycle is never sent from here.
 */
export function ExpenseDialog({ vehicleId, expense, onClose, onSaved }: ExpenseDialogProps) {
  const { t } = useTranslation();
  const categoryOptions = useEnumOptions('ExpenseCategory', ExpenseCategory.options);
  const paidByOptions = useEnumOptions('PaidBy', PaidBy.options);

  const form = useZodForm(ExpenseCreateSchema, {
    defaultValues: {
      category: expense?.category ?? 'REPAIR',
      date: expense?.date ?? todayInBusinessTz(),
      amount: expense?.amount,
      vatIncluded: expense?.vatIncluded ?? true,
      vatReclaimable: expense?.vatReclaimable ?? false,
      paidBy: expense?.paidBy ?? 'US',
      vendorId: expense?.vendorId ?? null,
      description: expense?.description ?? '',
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, { fields: EXPENSE_FIELDS });

  const mutation = useMutation({
    mutationFn: (body: Omit<ExpenseCreate, 'cycleId'>) =>
      expense ? updateExpense(expense.id, body) : createExpense(vehicleId, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async ({ cycleId: _cycleId, ...values }) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      title={expense ? t('vehicles.expenses.editTitle') : t('vehicles.expenses.addTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="category"
            label={t('vehicles.expenses.category')}
            options={categoryOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="date"
            label={t('vehicles.expenses.date')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="amount"
            label={t('vehicles.expenses.amount')}
            required
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="paidBy"
            label={t('vehicles.expenses.paidBy')}
            options={paidByOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormCheckboxField
            control={form.control}
            name="vatIncluded"
            label={t('vehicles.expenses.vatIncluded')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormCheckboxField
            control={form.control}
            name="vatReclaimable"
            label={t('vehicles.expenses.vatReclaimable')}
          />
        </Col>
        <Col xs={24}>
          <FormContactField
            control={form.control}
            name="vendorId"
            label={t('vehicles.expenses.vendor')}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="description"
            label={t('vehicles.expenses.description')}
            maxLength={1000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
