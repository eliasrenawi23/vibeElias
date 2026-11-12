import {
  isoDate,
  nextAnnualFeeDueAt,
  TaxiLicenseFeePaidSchema,
  todayInBusinessTz,
  type TaxiLicenseFeePaid,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Descriptions, Row } from 'antd';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { displayPlate } from '../../../shared/lib/plate';
import { DateText } from '../../../shared/ui/DateText';
import { DESCRIPTION_COLUMNS_SINGLE } from '../../../shared/ui/descriptionColumns';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { markAnnualFeePaid } from '../api';
import type { TaxiLicenseDetail } from '../types';

/** The dialog's form: the payment date is required here (the API defaults it to today). */
export const FeePaidFormSchema = TaxiLicenseFeePaidSchema.extend({ paidAt: isoDate });

export interface FeePaidDialogProps {
  license: TaxiLicenseDetail;
  onClose: () => void;
  /** The updated licence, and whether the amount was recorded as an expense on the car. */
  onSaved: (license: TaxiLicenseDetail, expenseRecorded: boolean) => void;
}

/**
 * "Annual fee paid": the payment date, the amount (recorded as a licence-fee expense on the
 * registered car; without a car only the due date moves) and a note. Shows the next due date
 * (31 December of the following year) before saving.
 */
export function FeePaidDialog({ license, onClose, onSaved }: FeePaidDialogProps) {
  const { t } = useTranslation();
  const car = license.registeredVehicle;
  const form = useZodForm(FeePaidFormSchema, {
    defaultValues: { paidAt: todayInBusinessTz(), amount: null, note: '' },
  });
  const paidAt = useWatch({ control: form.control, name: 'paidAt' });
  const nextDue = nextAnnualFeeDueAt(license.annualFeeDueAt, paidAt || todayInBusinessTz());
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['paidAt', 'amount', 'note'],
  });
  const mutation = useMutation({
    mutationFn: (body: TaxiLicenseFeePaid) => markAnnualFeePaid(license.id, body),
  });

  const submit = form.handleSubmit(async (v) => {
    const amount = car ? (v.amount ?? null) : null;
    try {
      const updated = await mutation.mutateAsync({ paidAt: v.paidAt, amount, note: v.note ?? null });
      onSaved(updated, amount !== null);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('taxiLicenses.feePaid.title')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      okText={t('taxiLicenses.feePaid.submit')}
      error={formError}
    >
      <div data-testid="fee-paid-dialog">
        <Descriptions
          size="small"
          column={DESCRIPTION_COLUMNS_SINGLE}
          className="rm-dialog-note"
          items={[
            {
              key: 'current',
              label: t('taxiLicenses.fields.annualFeeDueAt'),
              children: <DateText value={license.annualFeeDueAt} />,
            },
            {
              key: 'next',
              label: t('taxiLicenses.feePaid.nextDue'),
              children: (
                <span data-testid="fee-paid-next" data-date={nextDue}>
                  <DateText value={nextDue} />
                </span>
              ),
            },
          ]}
        />
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <FormDateField
              control={form.control}
              name="paidAt"
              label={t('taxiLicenses.feePaid.paidAt')}
              required
              allowClear={false}
            />
          </Col>
          {car && (
            <Col xs={24} sm={12}>
              <FormMoneyField
                control={form.control}
                name="amount"
                label={t('taxiLicenses.feePaid.amount')}
                min={0}
                help={t('taxiLicenses.feePaid.amountHelp', {
                  plate: isolateLtr(displayPlate(car.plateNo)),
                })}
              />
            </Col>
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
        {!car && (
          <Alert
            type="info"
            showIcon
            title={t('taxiLicenses.feePaid.noVehicle')}
            data-testid="fee-paid-no-vehicle"
          />
        )}
      </div>
    </FormDialog>
  );
}
