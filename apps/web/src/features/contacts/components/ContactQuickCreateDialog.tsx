import { ContactCreateSchema, ContactTag, msg, optionalPhone } from '@renawi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { phoneInputProps } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { createContact } from '../api';
import { contactKeys } from '../queryKeys';
import type { Contact } from '../types';

/** Minimal contact: a name, one optional phone and tags. */
const QuickContactSchema = ContactCreateSchema.innerType()
  .pick({ firstName: true, lastName: true, companyName: true, tags: true })
  .extend({ phone: optionalPhone })
  .superRefine((v, ctx) => {
    if (!v.firstName && !v.lastName && !v.companyName) {
      for (const path of ['firstName', 'companyName']) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: msg.nameRequired });
      }
    }
  });

export interface ContactQuickCreateDialogProps {
  /** Tags preset on the new contact (e.g. the picker's tag filter). */
  presetTags?: ContactTag[];
  /** Name typed in the picker search, used to prefill the first name. */
  initialName?: string;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}

/** "Create new contact" from a picker: posts the contact and hands it back. */
export function ContactQuickCreateDialog({
  presetTags = [],
  initialName = '',
  onCreated,
  onCancel,
}: ContactQuickCreateDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tagOptions = useEnumOptions('ContactTag', ContactTag.options);
  const [first = '', ...rest] = initialName.trim().split(/\s+/);
  const form = useZodForm(QuickContactSchema, {
    defaultValues: {
      firstName: first,
      lastName: rest.join(' '),
      companyName: '',
      phone: '',
      tags: presetTags,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError);

  const mutation = useMutation({
    mutationFn: createContact,
    onSuccess: (contact) => {
      void queryClient.invalidateQueries({ queryKey: contactKeys.all });
      onCreated(contact);
    },
  });

  const submit = form.handleSubmit(async ({ phone, ...values }) => {
    try {
      await mutation.mutateAsync(
        ContactCreateSchema.parse({ ...values, phones: phone ? [phone] : [] }),
      );
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={t('contacts.picker.quickCreateTitle')}
      okText={t('actions.create')}
      onSubmit={submit}
      onCancel={onCancel}
      submitting={mutation.isPending}
      error={formError}
    >
      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <FormTextField control={form.control} name="firstName" label={t('contacts.fields.firstName')} />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField control={form.control} name="lastName" label={t('contacts.fields.lastName')} />
        </Col>
        <Col xs={24}>
          <FormTextField
            control={form.control}
            name="companyName"
            label={t('contacts.fields.companyName')}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormTextField
            control={form.control}
            name="phone"
            label={t('common.phone')}
            inputProps={phoneInputProps}
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormSelect
            control={form.control}
            name="tags"
            label={t('contacts.fields.tags')}
            options={tagOptions}
            mode="multiple"
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
