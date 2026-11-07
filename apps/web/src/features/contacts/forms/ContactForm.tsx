import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { ContactTag, LOCALES, type ContactCreate } from '@renawi/shared';
import { Alert, Button, Card, Col, Flex, Form, Input, Row, Segmented } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useController, useFormState, type Control } from 'react-hook-form';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { ltrInputProps, numericInputProps, phoneInputProps } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useDynamicT } from '../../../shared/lib/i18n';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { isCompany } from '../lib';
import type { Contact } from '../types';
import {
  ContactFormSchema,
  toContactFormValues,
  type ContactFormInput,
  type ContactFormOutput,
} from './contactFormSchema';

const MAX_PHONES = 5;

export interface ContactFormProps {
  /** Existing contact (edit) or nothing (create). */
  contact?: Contact | null;
  /** Resolves when saved; rejects with the API error (field errors are mapped). */
  onSubmit: (values: ContactCreate) => Promise<unknown>;
  submitting: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

type ContactKind = 'person' | 'company';

/** Create / edit form for a contact (person or company) built on `ContactCreateSchema`. */
export function ContactForm({ contact, onSubmit, submitting, onCancel, submitLabel }: ContactFormProps) {
  const { t } = useTranslation();
  const tagOptions = useEnumOptions('ContactTag', ContactTag.options);
  const langOptions = LOCALES.map((lng) => ({ value: lng, label: t(`language.${lng}`) }));
  const [kind, setKind] = useState<ContactKind>(contact && isCompany(contact) ? 'company' : 'person');
  const form = useZodForm(ContactFormSchema, { defaultValues: toContactFormValues(contact) });
  const { control } = form;
  const { formError, handleError, clearFormError } = useFormErrors(form.setError);

  const submit = form.handleSubmit(async (values: ContactFormOutput) => {
    clearFormError();
    // A company has no person name; the hidden fields must not keep stale text.
    const body: ContactCreate =
      kind === 'company' ? { ...values, firstName: null, lastName: null } : values;
    try {
      await onSubmit(body);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('contacts.detailTitle')} className="rm-contact-form">
      <Flex vertical gap={16}>
        {formError && <Alert type="error" showIcon title={formError} />}
        <Card title={t('contacts.sections.identity')} variant="borderless">
          <Form.Item label={t('contacts.contactType')}>
            <Segmented<ContactKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: 'person', label: t('contacts.person') },
                { value: 'company', label: t('contacts.company') },
              ]}
              data-testid="contact-kind"
            />
          </Form.Item>
          <Row gutter={16}>
            {kind === 'person' ? (
              <>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={control}
                    name="firstName"
                    label={t('contacts.fields.firstName')}
                    inputProps={{ autoComplete: 'given-name' }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={control}
                    name="lastName"
                    label={t('contacts.fields.lastName')}
                    inputProps={{ autoComplete: 'family-name' }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <FormTextField
                    control={control}
                    name="companyName"
                    label={`${t('contacts.fields.companyName')} (${t('common.optional')})`}
                    inputProps={{ autoComplete: 'organization' }}
                  />
                </Col>
              </>
            ) : (
              <Col xs={24} md={16}>
                <FormTextField
                  control={control}
                  name="companyName"
                  label={t('contacts.fields.companyName')}
                  required
                  inputProps={{ autoComplete: 'organization' }}
                />
              </Col>
            )}
            <Col xs={24} md={8}>
              <FormTextField
                control={control}
                name="idNumber"
                label={t('contacts.fields.idNumber')}
                help={t('contacts.idNumberHelp')}
                inputProps={{ ...numericInputProps, maxLength: 12 }}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('contacts.sections.contact')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <PhonesField control={control} />
            </Col>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="email"
                type="email"
                label={t('contacts.fields.email')}
                inputProps={{ ...ltrInputProps, autoComplete: 'email' }}
              />
            </Col>
            <Col xs={24} md={12}>
              <FormTextField
                control={control}
                name="address"
                label={t('contacts.fields.address')}
                inputProps={{ autoComplete: 'street-address' }}
              />
            </Col>
            <Col xs={24} md={6}>
              <FormTextField
                control={control}
                name="city"
                label={t('contacts.fields.city')}
                inputProps={{ autoComplete: 'address-level2' }}
              />
            </Col>
            <Col xs={24} md={6}>
              <FormSelect
                control={control}
                name="preferredLang"
                label={t('contacts.fields.preferredLang')}
                options={langOptions}
                required
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('contacts.sections.crm')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormSelect
                control={control}
                name="tags"
                label={t('contacts.fields.tags')}
                options={tagOptions}
                mode="multiple"
              />
            </Col>
            <Col xs={24} md={6}>
              <FormTextField
                control={control}
                name="source"
                label={t('contacts.fields.source')}
                help={t('contacts.sourceHelp')}
              />
            </Col>
            <Col xs={24} md={6}>
              <FormDateField control={control} name="followUpAt" label={t('contacts.fields.followUpAt')} />
            </Col>
            <Col xs={24}>
              <FormTextAreaField control={control} name="notes" label={t('contacts.fields.notes')} />
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" className="rm-form-actions">
          {onCancel && (
            <Button onClick={onCancel} disabled={submitting}>
              {t('actions.cancel')}
            </Button>
          )}
          <Button type="primary" htmlType="submit" loading={submitting} data-testid="contact-save">
            {submitLabel ?? t('actions.save')}
          </Button>
        </Flex>
      </Flex>
    </FormLayout>
  );
}

/** Editable list of phone numbers (first = primary), each validated by the shared `phone`. */
function PhonesField({ control }: { control: Control<ContactFormInput, unknown, ContactFormOutput> }) {
  const { t } = useTranslation();
  const dynamicT = useDynamicT();
  const { field } = useController({ control, name: 'phones' });
  const { errors } = useFormState({ control, name: 'phones' });
  const phones = field.value ?? [];
  const raw = errors.phones as
    | (Array<{ message?: string } | undefined> & { message?: string; root?: { message?: string } })
    | undefined;
  const itemError = (i: number) => raw?.[i]?.message;
  const listError = raw?.message ?? raw?.root?.message;
  const translate = (m?: string) => (m ? dynamicT(m, 'validation.invalidPhone') : undefined);

  return (
    <Form.Item
      label={t('contacts.fields.phones')}
      validateStatus={listError ? 'error' : undefined}
      help={translate(listError)}
    >
      <Flex vertical gap={8}>
        {phones.map((phone, i) => {
          const message = translate(itemError(i));
          return (
            <div key={i}>
              <Flex gap={8} align="center">
                <Input
                  name={`phones.${i}`}
                  value={phone}
                  aria-label={`${t('common.phone')} ${i + 1}`}
                  status={message ? 'error' : undefined}
                  aria-invalid={message ? true : undefined}
                  onChange={(e) => field.onChange(phones.map((p, j) => (j === i ? e.target.value : p)))}
                  onBlur={field.onBlur}
                  {...phoneInputProps}
                />
                <Button
                  type="text"
                  icon={<MinusCircleOutlined />}
                  aria-label={t('contacts.removePhone')}
                  onClick={() => field.onChange(phones.filter((_, j) => j !== i))}
                />
              </Flex>
              {message && <div className="ant-form-item-explain-error rm-field-error">{message}</div>}
            </div>
          );
        })}
        {phones.length < MAX_PHONES && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => field.onChange([...phones, ''])}
            className="rm-add-phone"
          >
            {t('contacts.addPhone')}
          </Button>
        )}
      </Flex>
    </Form.Item>
  );
}
