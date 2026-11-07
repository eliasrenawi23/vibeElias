import { ArrowLeftOutlined } from '@ant-design/icons';
import { LOCALES } from '@renawi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Flex, Form, Row, Segmented } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { ltrInputProps, numericInputProps, phoneInputProps } from '../../../shared/lib/bidi';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { FormContactField } from '../../contacts/components/FormContactField';
import { contactKeys } from '../../contacts/queryKeys';
import type { Contact } from '../../contacts/types';
import { createDriver } from '../api';
import { DriverFields } from '../forms/DriverFields';
import {
  DriverNewFormSchema,
  toDriverCreateBody,
  toDriverFieldValues,
  type ContactMode,
} from '../forms/driverFormSchema';
import { driverPath } from '../lib/driverRules';
import { driverKeys } from '../queryKeys';

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link to="/drivers" className="rm-back-link">
      <ArrowLeftOutlined className="rm-flip-rtl" /> {t('common.backToList')}
    </Link>
  );
}

/** Top-level fields of the form; API errors on other paths go to the alert. */
const FORM_FIELDS = [
  'contactId',
  'contact',
  'licenseNo',
  'licenseExpiry',
  'taxiPermitNo',
  'taxiPermitExpiry',
  'medicalExpiry',
  'emergencyName',
  'emergencyPhone',
  'startedAt',
  'notes',
] as const;

/**
 * `/drivers/new` (optionally `?contactId=`): step 1 links an existing contact or creates one
 * inline, step 2 records the driver's licence, permit and medical details.
 */
export function DriverNewPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const presetContact = params.get('contactId');
  const [existingDriver, setExistingDriver] = useState<{ id: string } | null>(null);
  const langOptions = LOCALES.map((lng) => ({ value: lng, label: t(`language.${lng}`) }));

  const form = useZodForm(DriverNewFormSchema, {
    defaultValues: {
      ...toDriverFieldValues(),
      contactMode: 'existing',
      contactId: presetContact,
      contact: {
        firstName: '',
        lastName: '',
        idNumber: '',
        phone: '',
        email: '',
        preferredLang: 'he',
      },
    },
  });
  const mode = form.watch('contactMode');
  const { formError, handleError, clearFormError } = useFormErrors(form.setError, {
    fields: FORM_FIELDS,
  });

  const mutation = useMutation({
    mutationFn: createDriver,
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: driverKeys.all });
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
      void message.success(t('drivers.created'));
      navigate(driverPath(created.id), { replace: true });
    },
  });

  const submit = form.handleSubmit(async (values) => {
    clearFormError();
    try {
      await mutation.mutateAsync(toDriverCreateBody(values));
    } catch (error) {
      handleError(error);
    }
  });

  const onPicked = (contact: Contact | null) => {
    setExistingDriver(contact?.driver ? { id: contact.driver.id } : null);
  };

  return (
    <Flex vertical gap={16}>
      <BackLink />
      <FormLayout onSubmit={submit} aria-label={t('drivers.newTitle')}>
        <Flex vertical gap={16}>
          {formError && <Alert type="error" showIcon title={formError} />}
          <Card variant="borderless" title={t('drivers.form.stepContact')}>
            <Form.Item label={t('drivers.form.contactSource')}>
              <Segmented<ContactMode>
                value={mode}
                onChange={(v) => {
                  form.setValue('contactMode', v);
                  form.clearErrors(['contactId', 'contact']);
                }}
                options={[
                  { value: 'existing', label: t('drivers.form.existingContact') },
                  { value: 'new', label: t('drivers.form.newContact') },
                ]}
                data-testid="driver-contact-mode"
              />
            </Form.Item>
            {mode === 'existing' ? (
              <>
                <FormContactField
                  control={form.control}
                  name="contactId"
                  label={t('drivers.fields.contact')}
                  required
                  help={t('drivers.form.contactHelp')}
                  onPicked={onPicked}
                />
                {existingDriver && (
                  <Alert
                    type="warning"
                    showIcon
                    title={t('drivers.form.alreadyDriver')}
                    action={
                      <Link to={driverPath(existingDriver.id)}>{t('drivers.openProfile')}</Link>
                    }
                  />
                )}
              </>
            ) : (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={form.control}
                    name="contact.firstName"
                    label={t('contacts.fields.firstName')}
                    required
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={form.control}
                    name="contact.lastName"
                    label={t('contacts.fields.lastName')}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={form.control}
                    name="contact.idNumber"
                    label={t('contacts.fields.idNumber')}
                    help={t('contacts.idNumberHelp')}
                    inputProps={{ ...numericInputProps, maxLength: 12 }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={form.control}
                    name="contact.phone"
                    label={t('common.phone')}
                    inputProps={phoneInputProps}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={form.control}
                    name="contact.email"
                    type="email"
                    label={t('contacts.fields.email')}
                    inputProps={ltrInputProps}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormSelect
                    control={form.control}
                    name="contact.preferredLang"
                    label={t('contacts.fields.preferredLang')}
                    options={langOptions}
                    required
                  />
                </Col>
              </Row>
            )}
          </Card>
          <Card variant="borderless" title={t('drivers.form.stepDriver')}>
            <DriverFields control={form.control} />
          </Card>
          <Flex gap={8} justify="flex-end" className="rm-form-actions">
            <Button onClick={() => navigate('/drivers')} disabled={mutation.isPending}>
              {t('actions.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={mutation.isPending}
              data-testid="driver-save"
            >
              {t('actions.create')}
            </Button>
          </Flex>
        </Flex>
      </FormLayout>
    </Flex>
  );
}
