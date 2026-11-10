import {
  TaxiLicenseCreateSchema,
  TaxiLicenseStatus,
  todayInBusinessTz,
  type TaxiLicenseCreate,
  type TaxiLicenseCreateInput,
} from '@renawi/shared';
import { Alert, Button, Card, Col, Flex, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useUnsavedChangesGuard } from '../../../shared/form/useUnsavedChangesGuard';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { defaultAnnualFeeDue } from '../lib/licenseRules';
import type { TaxiLicense } from '../types';

export interface TaxiLicenseFormProps {
  /** Existing licence (edit) or nothing (create). */
  license?: TaxiLicense | null;
  /** Resolves when saved; rejects with the API error (field errors are mapped). */
  onSubmit: (values: TaxiLicenseCreate) => Promise<unknown>;
  submitting: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

/** API licence (or nothing) to form values; the annual fee defaults to 31 December this year. */
export function toLicenseFormValues(l?: TaxiLicense | null): TaxiLicenseCreateInput {
  return {
    licenseNo: l?.licenseNo ?? '',
    holderName: l?.holderName ?? '',
    status: l?.status ?? 'ACTIVE',
    acquiredAt: l?.acquiredAt ?? null,
    acquisitionPrice: l?.acquisitionPrice ?? null,
    soldAt: l?.soldAt ?? null,
    salePrice: l?.salePrice ?? null,
    annualFeeDueAt: l ? l.annualFeeDueAt : defaultAnnualFeeDue(todayInBusinessTz()),
    renewalAt: l?.renewalAt ?? null,
    notes: l?.notes ?? '',
  };
}

/** Create / edit a taxi licence ("green number"). */
export function TaxiLicenseForm({
  license,
  onSubmit,
  submitting,
  onCancel,
  submitLabel,
}: TaxiLicenseFormProps) {
  const { t } = useTranslation();
  const statusOptions = useEnumOptions('TaxiLicenseStatus', TaxiLicenseStatus.options);
  const form = useZodForm(TaxiLicenseCreateSchema, { defaultValues: toLicenseFormValues(license) });
  const { control } = form;
  const status = form.watch('status');
  const { formError, handleError, clearFormError } = useFormErrors(form.setError);

  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  const submit = form.handleSubmit(async (values) => {
    clearFormError();
    try {
      await guard.submit(() => onSubmit(values));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('taxiLicenses.detailTitle')}>
      <Flex vertical gap={16}>
        {formError && <Alert type="error" showIcon title={formError} />}
        <Card variant="borderless" title={t('taxiLicenses.sections.identity')}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="licenseNo"
                label={t('taxiLicenses.fields.licenseNo')}
                required
                help={t('taxiLicenses.form.licenseNoHelp')}
                inputProps={{ dir: 'ltr', spellCheck: false, maxLength: 20 }}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="holderName"
                label={t('taxiLicenses.fields.holderName')}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormSelect
                control={control}
                name="status"
                label={t('common.status')}
                options={statusOptions}
                required
              />
            </Col>
          </Row>
        </Card>
        <Card variant="borderless" title={t('taxiLicenses.sections.dates')}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <FormDateField
                control={control}
                name="annualFeeDueAt"
                label={t('taxiLicenses.fields.annualFeeDueAt')}
                help={t('taxiLicenses.form.annualFeeHelp')}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormDateField
                control={control}
                name="renewalAt"
                label={t('taxiLicenses.fields.renewalAt')}
              />
            </Col>
          </Row>
        </Card>
        <Card variant="borderless" title={t('taxiLicenses.sections.money')}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <FormDateField
                control={control}
                name="acquiredAt"
                label={t('taxiLicenses.fields.acquiredAt')}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormMoneyField
                control={control}
                name="acquisitionPrice"
                label={t('taxiLicenses.fields.acquisitionPrice')}
                min={0}
                precision={0}
              />
            </Col>
            {status === 'SOLD' && (
              <>
                <Col xs={24} md={8}>
                  <FormDateField
                    control={control}
                    name="soldAt"
                    label={t('taxiLicenses.fields.soldAt')}
                    required
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormMoneyField
                    control={control}
                    name="salePrice"
                    label={t('taxiLicenses.fields.salePrice')}
                    min={0}
                    precision={0}
                  />
                </Col>
              </>
            )}
            <Col xs={24}>
              <FormTextAreaField control={control} name="notes" label={t('common.notes')} />
            </Col>
          </Row>
        </Card>
        <Flex gap={8} justify="flex-end" className="rm-form-actions">
          {onCancel && (
            <Button onClick={() => guard.confirmDiscard(onCancel)} disabled={submitting}>
              {t('actions.cancel')}
            </Button>
          )}
          <Button type="primary" htmlType="submit" loading={submitting} data-testid="license-save">
            {submitLabel ?? t('actions.save')}
          </Button>
        </Flex>
      </Flex>
      {guard.prompt}
    </FormLayout>
  );
}
