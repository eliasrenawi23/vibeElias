import { idString } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Descriptions, Typography } from 'antd';
import { useId } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DateText } from '../../../shared/ui/DateText';
import { FieldShell } from '../../../shared/ui/FieldShell';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { Money } from '../../../shared/ui/Money';
import { DriverPicker } from '../../drivers/components/DriverPicker';
import { rebillExpense, type ExpenseRebillBody } from '../api';
import type { VehicleExpense } from '../types';
import { DESCRIPTION_COLUMNS_NARROW } from '../../../shared/ui/descriptionColumns';

const RebillSchema = z.object({ driverId: idString.nullish() });

export interface RebillExpenseDialogProps {
  expense: VehicleExpense;
  onClose: () => void;
  onSaved: (expense: VehicleExpense) => void;
}

/**
 * "Rebill to driver": charge an expense we paid on a taxi to the driver who had it on that date
 * (matched by the API), or to a driver picked here.
 */
export function RebillExpenseDialog({ expense, onClose, onSaved }: RebillExpenseDialogProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const fieldId = useId();
  const form = useZodForm(RebillSchema, { defaultValues: { driverId: null } });
  const { field, fieldState } = useController({ control: form.control, name: 'driverId' });
  // Errors (no driver matched, already rebilled) are shown in the dialog's alert.
  const { formError, handleError } = useFormErrors(form.setError, { fields: ['driverId'] });
  const mutation = useMutation({
    mutationFn: (body: ExpenseRebillBody) => rebillExpense(expense.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (v) => {
    try {
      await mutation.mutateAsync(v.driverId ? { driverId: v.driverId } : {});
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('vehicles.expenses.rebillTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      okText={t('vehicles.expenses.rebill')}
    >
      <Typography.Paragraph>{t('vehicles.expenses.rebillConfirm')}</Typography.Paragraph>
      <Descriptions
        size="small"
        column={DESCRIPTION_COLUMNS_NARROW}
        items={[
          {
            key: 'date',
            label: t('vehicles.expenses.date'),
            children: <DateText value={expense.date} />,
          },
          {
            key: 'category',
            label: t('vehicles.expenses.category'),
            children: enumLabel('ExpenseCategory', expense.category),
          },
          {
            key: 'amount',
            label: t('vehicles.expenses.amount'),
            children: <Money amount={expense.amount} />,
          },
        ]}
      />
      <FieldShell
        id={fieldId}
        label={t('vehicles.expenses.rebillDriver')}
        help={t('vehicles.expenses.rebillDriverHelp')}
        error={fieldState.error}
      >
        <DriverPicker
          id={fieldId}
          value={field.value ?? null}
          onChange={(id) => field.onChange(id)}
          onBlur={field.onBlur}
          activeOnly={false}
          placeholder={t('vehicles.expenses.rebillAuto')}
        />
      </FieldShell>
    </FormDialog>
  );
}
