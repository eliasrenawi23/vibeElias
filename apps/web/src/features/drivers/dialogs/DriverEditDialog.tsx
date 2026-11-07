import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { updateDriver } from '../api';
import { DriverFields } from '../forms/DriverFields';
import {
  DriverFieldsSchema,
  toDriverFieldsBody,
  toDriverFieldValues,
} from '../forms/driverFormSchema';
import type { DriverDetail } from '../types';

export interface DriverEditDialogProps {
  driver: DriverDetail;
  onClose: () => void;
  onSaved: (driver: DriverDetail) => void;
}

/** Edit the driver columns (status, permits, emergency contact, notes). */
export function DriverEditDialog({ driver, onClose, onSaved }: DriverEditDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(DriverFieldsSchema, { defaultValues: toDriverFieldValues(driver) });
  const { formError, handleError } = useFormErrors(form.setError);
  const mutation = useMutation({
    mutationFn: (body: ReturnType<typeof toDriverFieldsBody>) => updateDriver(driver.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(toDriverFieldsBody(values));
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={t('drivers.editTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={720}
    >
      <DriverFields control={form.control} showStatus />
    </FormDialog>
  );
}
