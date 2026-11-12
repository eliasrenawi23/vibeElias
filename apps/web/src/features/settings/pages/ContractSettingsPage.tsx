import {
  DEFAULT_LEASE_TERMS,
  DefaultLeaseTermsSchema,
  type DefaultLeaseTerms,
  type SettingsResponse,
} from '@renawi/shared';
import { Button, Card, Col, Flex, Row, Typography } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useUnsavedChangesGuard } from '../../../shared/form/useUnsavedChangesGuard';
import { applyApiErrors, useZodForm } from '../../../shared/form/useZodForm';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ResponsibilitiesField } from '../../leases/components/ResponsibilitiesField';
import { SettingsGate, useSaveSettings, useSettingsQuery } from '../hooks';

const ContractTermsFormSchema = z.object({ defaultLeaseTerms: DefaultLeaseTermsSchema });

function toValues(settings: SettingsResponse) {
  const terms = settings.defaultLeaseTerms ?? DEFAULT_LEASE_TERMS;
  return {
    defaultLeaseTerms: {
      responsibilities: { ...DEFAULT_LEASE_TERMS.responsibilities, ...terms.responsibilities },
      clauses: { ...DEFAULT_LEASE_TERMS.clauses, ...terms.clauses },
    },
  };
}

/** `/settings/contracts`: default responsibilities and the standard clauses in he / ar / en. */
export function ContractSettingsPage() {
  const { t } = useTranslation();
  const query = useSettingsQuery();
  const save = useSaveSettings();
  return (
    <Flex vertical gap={16} className="rm-settings-page">
      <PageHeader subtitle={t('settings.contracts.description')} />
      <SettingsGate query={query}>
        {(settings) => (
          <ContractTermsForm
            settings={settings}
            saving={save.isPending}
            onSave={(terms) => save.mutateAsync({ defaultLeaseTerms: terms })}
          />
        )}
      </SettingsGate>
    </Flex>
  );
}

function ContractTermsForm({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (terms: DefaultLeaseTerms) => Promise<SettingsResponse>;
}) {
  const { t } = useTranslation();
  const form = useZodForm(ContractTermsFormSchema, { defaultValues: toValues(settings) });
  const { control, reset, setError, formState } = form;
  useEffect(() => {
    reset(toValues(settings));
  }, [settings, reset]);
  const guard = useUnsavedChangesGuard(formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    try {
      await guard.submit(() => onSave(values.defaultLeaseTerms));
    } catch (error) {
      applyApiErrors(setError, error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('settings.nav.contracts')}>
      <Flex vertical gap={16}>
        <Card title={t('settings.contracts.responsibilities')} variant="borderless">
          <Typography.Paragraph type="secondary">
            {t('settings.contracts.responsibilitiesHelp')}
          </Typography.Paragraph>
          <ResponsibilitiesField control={control} name="defaultLeaseTerms.responsibilities" />
        </Card>
        <Card title={t('settings.contracts.clauses')} variant="borderless">
          <Typography.Paragraph type="secondary">
            {t('settings.contracts.clausesHelp')}
          </Typography.Paragraph>
          <Row gutter={16}>
            <Col xs={24} lg={8}>
              <FormTextAreaField
                control={control}
                name="defaultLeaseTerms.clauses.he"
                label={t('settings.contracts.clausesHe')}
                minRows={6}
                maxRows={20}
              />
            </Col>
            <Col xs={24} lg={8}>
              <FormTextAreaField
                control={control}
                name="defaultLeaseTerms.clauses.ar"
                label={t('settings.contracts.clausesAr')}
                minRows={6}
                maxRows={20}
              />
            </Col>
            <Col xs={24} lg={8}>
              <FormTextAreaField
                control={control}
                name="defaultLeaseTerms.clauses.en"
                label={t('settings.contracts.clausesEn')}
                minRows={6}
                maxRows={20}
              />
            </Col>
          </Row>
        </Card>
        <Flex gap={8} justify="flex-end" className="rm-form-actions">
          <Button onClick={() => reset(toValues(settings))} disabled={!formState.isDirty || saving}>
            {t('actions.reset')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!formState.isDirty}
            data-testid="contract-terms-save"
          >
            {t('actions.save')}
          </Button>
        </Flex>
      </Flex>
      {guard.prompt}
    </FormLayout>
  );
}
