import {
  addDays,
  addMonths,
  BUSINESS_INSURANCE_TYPES,
  InsuranceCreateSchema,
  InsuranceType,
  PaidBy,
  todayInBusinessTz,
  type InsuranceScope,
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
import { FormTextField } from '../../../shared/ui/FormTextField';
import {
  createBusinessInsurance,
  createVehicleInsurance,
  updateInsurance,
} from '../api';
import type { InsurancePolicy } from '../types';

const VEHICLE_TYPES = InsuranceType.options.filter((v) => !BUSINESS_INSURANCE_TYPES.includes(v));

export interface InsuranceDialogProps {
  scope: InsuranceScope;
  /** Required for VEHICLE scope. */
  vehicleId?: string;
  /** Offer the taxi-extension flag (vehicle policies of taxis). */
  isTaxi?: boolean;
  /** Policy being edited; omitted to add one. */
  policy?: InsurancePolicy | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Add / edit an insurance policy of a vehicle or of the business (trade / lot). */
export function InsuranceDialog({
  scope,
  vehicleId,
  isTaxi = false,
  policy,
  onClose,
  onSaved,
}: InsuranceDialogProps) {
  const { t } = useTranslation();
  const typeOptions = useEnumOptions(
    'InsuranceType',
    scope === 'BUSINESS' ? BUSINESS_INSURANCE_TYPES : VEHICLE_TYPES,
  );
  const paidByOptions = useEnumOptions('PaidBy', PaidBy.options);
  const today = todayInBusinessTz();

  const form = useZodForm(InsuranceCreateSchema, {
    defaultValues: {
      scope,
      type: policy?.type ?? (scope === 'BUSINESS' ? 'TRADE' : 'COMPULSORY'),
      insurer: policy?.insurer ?? '',
      policyNo: policy?.policyNo ?? '',
      startDate: policy?.startDate ?? today,
      endDate: policy?.endDate ?? addDays(addMonths(today, 12), -1),
      premium: policy?.premium ?? null,
      paidBy: policy?.paidBy ?? 'US',
      hasTaxiExtension: policy?.hasTaxiExtension ?? false,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError);

  const mutation = useMutation({
    mutationFn: async (values: ReturnType<typeof InsuranceCreateSchema.parse>) => {
      const { scope: _scope, vehicleId: _vehicleId, ...fields } = values;
      if (policy) return updateInsurance(policy.id, fields);
      if (scope === 'BUSINESS') return createBusinessInsurance({ ...fields, scope: 'BUSINESS' });
      if (!vehicleId) throw new Error('vehicleId is required for a vehicle policy');
      return createVehicleInsurance(vehicleId, { ...fields, scope: 'VEHICLE' });
    },
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      title={policy ? t('vehicles.insurance.editTitle') : t('vehicles.insurance.addTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="type"
            label={t('vehicles.insurance.type')}
            options={typeOptions}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="insurer"
            label={t('vehicles.insurance.insurer')}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="policyNo"
            label={t('vehicles.insurance.policyNo')}
            inputProps={{ dir: 'ltr', spellCheck: false }}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormMoneyField
            control={form.control}
            name="premium"
            label={t('vehicles.insurance.premium')}
            min={0}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="startDate"
            label={t('vehicles.insurance.startDate')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="endDate"
            label={t('vehicles.insurance.endDate')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="paidBy"
            label={t('vehicles.insurance.paidBy')}
            options={paidByOptions}
            required
          />
        </Col>
        {scope === 'VEHICLE' && isTaxi && (
          <Col xs={24} sm={12}>
            <FormCheckboxField
              control={form.control}
              name="hasTaxiExtension"
              label={t('vehicles.insurance.hasTaxiExtension')}
            />
          </Col>
        )}
      </Row>
    </FormDialog>
  );
}
