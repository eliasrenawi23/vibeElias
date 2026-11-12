import {
  ReminderCreateSchema,
  todayInBusinessTz,
  type EntityType,
  type ReminderCreate,
  type ReminderView,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, App, Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { useEnumLabel } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { createReminder, updateReminder } from '../api';
import { useRefreshReminders } from '../hooks';

export interface ReminderDialogProps {
  /** Edit this reminder; omitted = a new one. */
  reminder?: ReminderView | null;
  /** New reminder linked to a record (the "+ reminder" action of a record page). */
  entityType?: EntityType | null;
  entityId?: string | null;
  onClose: () => void;
  onSaved?: (reminder: ReminderView) => void;
}

/** Add or edit a manual reminder: title, due date, notes; optionally linked to a record. */
export function ReminderDialog({
  reminder,
  entityType,
  entityId,
  onClose,
  onSaved,
}: ReminderDialogProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const enumLabel = useEnumLabel();
  const refresh = useRefreshReminders();
  const linkType = reminder ? reminder.entityType : (entityType ?? null);
  const linkId = reminder ? reminder.entityId : (entityId ?? null);

  const form = useZodForm(ReminderCreateSchema, {
    defaultValues: {
      title: reminder?.title ?? '',
      dueAt: reminder?.dueAt ?? todayInBusinessTz(),
      notes: reminder?.notes ?? '',
      ...(linkType && linkId ? { entityType: linkType, entityId: linkId } : {}),
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, {
    fields: ['title', 'dueAt', 'notes'],
  });

  const mutation = useMutation({
    mutationFn: (body: ReminderCreate) =>
      reminder
        ? updateReminder(reminder.id, { title: body.title, dueAt: body.dueAt, notes: body.notes })
        : createReminder(body),
    onSuccess: (saved) => {
      refresh();
      void message.success(reminder ? t('reminders.manual.saved') : t('reminders.manual.added'));
      onSaved?.(saved);
      onClose();
    },
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
      dirty={form.formState.isDirty}
      title={reminder ? t('reminders.manual.editTitle') : t('reminders.manual.addTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={520}
    >
      {linkType && linkId && (
        <Alert
          type="info"
          showIcon
          className="rm-dialog-note"
          title={t('reminders.manual.linkedHint', { entity: enumLabel('EntityType', linkType) })}
          data-testid="reminder-linked"
        />
      )}
      <Row gutter={12}>
        <Col xs={24}>
          <FormTextField
            control={form.control}
            name="title"
            label={t('reminders.fields.title')}
            required
          />
        </Col>
        <Col xs={24} sm={12}>
          <FormDateField
            control={form.control}
            name="dueAt"
            label={t('reminders.fields.dueAt')}
            required
            allowClear={false}
          />
        </Col>
        <Col xs={24}>
          <FormTextAreaField
            control={form.control}
            name="notes"
            label={t('common.notes')}
            minRows={2}
            maxRows={6}
            maxLength={2000}
          />
        </Col>
      </Row>
    </FormDialog>
  );
}
