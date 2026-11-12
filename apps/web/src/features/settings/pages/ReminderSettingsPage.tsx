import {
  DEFAULT_REMINDER_LEAD_DAYS,
  ReminderLeadDaysSchema,
  type ReminderLeadDays,
  type SettingsResponse,
} from '@renawi/shared';
import { Button, Card, Col, Flex, Row } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useUnsavedChangesGuard } from '../../../shared/form/useUnsavedChangesGuard';
import { applyApiErrors, useZodForm } from '../../../shared/form/useZodForm';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { dashboardKeys } from '../../dashboard/queryKeys';
import { reminderKeys } from '../../reminders/queryKeys';
import { SettingsGate, useSaveSettings, useSettingsQuery } from '../hooks';

const LeadDaysFormSchema = z.object({ reminderLeadDays: ReminderLeadDaysSchema });

/** Lead-day fields by section (every key of `ReminderLeadDays` exactly once). */
export const LEAD_DAY_SECTIONS: readonly {
  key: 'vehicles' | 'drivers' | 'licenses' | 'deals';
  fields: readonly (keyof ReminderLeadDays)[];
}[] = [
  { key: 'vehicles', fields: ['registration', 'insurance', 'dealerRegistration', 'taxiAge'] },
  { key: 'drivers', fields: ['driverLicense', 'taxiPermit', 'medical'] },
  { key: 'licenses', fields: ['taxiLicense', 'lease'] },
  { key: 'deals', fields: ['transfer', 'fine', 'document'] },
];

function toValues(settings: SettingsResponse) {
  return { reminderLeadDays: { ...DEFAULT_REMINDER_LEAD_DAYS, ...settings.reminderLeadDays } };
}

/** `/settings/reminders`: days before each kind of expiry or deadline it shows as "due soon". */
export function ReminderSettingsPage() {
  const { t } = useTranslation();
  const query = useSettingsQuery();
  const save = useSaveSettings([reminderKeys.all, dashboardKeys.all]);
  return (
    <Flex vertical gap={16} className="rm-settings-page">
      <PageHeader subtitle={t('settings.reminders.description')} />
      <SettingsGate query={query}>
        {(settings) => (
          <LeadDaysForm
            settings={settings}
            saving={save.isPending}
            onSave={(leadDays) => save.mutateAsync({ reminderLeadDays: leadDays })}
          />
        )}
      </SettingsGate>
    </Flex>
  );
}

function LeadDaysForm({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (leadDays: ReminderLeadDays) => Promise<SettingsResponse>;
}) {
  const { t } = useTranslation();
  const form = useZodForm(LeadDaysFormSchema, { defaultValues: toValues(settings) });
  const { control, reset, setError, formState } = form;
  useEffect(() => {
    reset(toValues(settings));
  }, [settings, reset]);
  const guard = useUnsavedChangesGuard(formState.isDirty);

  const submit = form.handleSubmit(async (values) => {
    try {
      // The whole object: nested settings are replaced, not merged.
      await guard.submit(() => onSave(values.reminderLeadDays));
    } catch (error) {
      applyApiErrors(setError, error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('settings.nav.reminders')}>
      <Flex vertical gap={16}>
        {LEAD_DAY_SECTIONS.map((section) => (
          <Card
            key={section.key}
            title={t(`settings.reminders.sections.${section.key}`)}
            variant="borderless"
          >
            <Row gutter={16}>
              {section.fields.map((field) => (
                <Col key={field} xs={24} md={12} xl={8}>
                  <FormNumberField
                    control={control}
                    name={`reminderLeadDays.${field}`}
                    label={t(`settings.reminders.fields.${field}`)}
                    help={t(`settings.reminders.help.${field}`)}
                    required
                    min={0}
                    max={365}
                    precision={0}
                    unit={t('units.days')}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        ))}
        <Flex gap={8} justify="flex-end" className="rm-form-actions">
          <Button onClick={() => reset(toValues(settings))} disabled={!formState.isDirty || saving}>
            {t('actions.reset')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            disabled={!formState.isDirty}
            data-testid="lead-days-save"
          >
            {t('actions.save')}
          </Button>
        </Flex>
      </Flex>
      {guard.prompt}
    </FormLayout>
  );
}
