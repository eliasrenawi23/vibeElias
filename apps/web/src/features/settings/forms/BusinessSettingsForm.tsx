import type { SettingsResponse } from '@renawi/shared';
import { Button, Card, Col, Flex, Row } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyApiErrors, useZodForm } from '../../../shared/form/useZodForm';
import { ltrInputProps, numericInputProps, phoneInputProps } from '../../../shared/lib/bidi';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import {
  BusinessSettingsFormSchema,
  toBusinessFormValues,
  type BusinessSettingsFormOutput,
} from './businessSettingsSchema';

export interface BusinessSettingsFormProps {
  settings: SettingsResponse;
  /** Resolves with the saved settings; rejects with the API error. */
  onSave: (values: BusinessSettingsFormOutput) => Promise<SettingsResponse>;
  saving: boolean;
}

export function BusinessSettingsForm({ settings, onSave, saving }: BusinessSettingsFormProps) {
  const { t } = useTranslation();
  const form = useZodForm(BusinessSettingsFormSchema, {
    defaultValues: toBusinessFormValues(settings),
  });
  const { control, reset, setError, formState } = form;

  // Server data changed (saved here or refetched): make it the new pristine state.
  useEffect(() => {
    reset(toBusinessFormValues(settings));
  }, [settings, reset]);

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSave(values);
    } catch (error) {
      applyApiErrors(setError, error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('settings.nav.business')}>
      <Flex vertical gap={16}>
        <Card title={t('settings.business.sections.name')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="businessName.he"
                label={t('settings.business.nameHe')}
                required
                inputProps={{ dir: 'rtl', lang: 'he' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="businessName.ar"
                label={t('settings.business.nameAr')}
                required
                inputProps={{ dir: 'rtl', lang: 'ar' }}
              />
            </Col>
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="businessName.en"
                label={t('settings.business.nameEn')}
                required
                inputProps={{ dir: 'ltr', lang: 'en' }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('settings.business.sections.identity')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="legalId"
                label={t('settings.business.legalId')}
                inputProps={numericInputProps}
              />
            </Col>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="dealerLicenseNo"
                label={t('settings.business.dealerLicenseNo')}
                inputProps={{ dir: 'ltr', spellCheck: false }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('settings.business.sections.contact')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24}>
              <FormTextField
                control={control}
                name="address"
                label={t('common.address')}
                inputProps={{ autoComplete: 'street-address' }}
              />
            </Col>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="phone"
                label={t('common.phone')}
                inputProps={phoneInputProps}
              />
            </Col>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="email"
                type="email"
                label={t('common.email')}
                inputProps={{ ...ltrInputProps, autoComplete: 'email' }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('settings.business.sections.tax')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <FormMoneyField
                control={control}
                name="vatRate"
                label={t('money.vatRate')}
                required
                unit={t('units.percent')}
                min={0}
                max={100}
                help={t('settings.business.vatRateHelp')}
              />
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" className="rm-form-actions">
          <Button
            onClick={() => reset(toBusinessFormValues(settings))}
            disabled={!formState.isDirty || saving}
          >
            {t('actions.reset')}
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={!formState.isDirty}>
            {t('actions.save')}
          </Button>
        </Flex>
      </Flex>
    </FormLayout>
  );
}
