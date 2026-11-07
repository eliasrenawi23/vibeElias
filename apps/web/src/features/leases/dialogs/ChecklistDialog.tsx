import {
  createHandoverChecklist,
  createReturnChecklist,
  HandoverChecklistSchema,
  ReturnChecklistSchema,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { updateChecklists } from '../api';
import { ChecklistFields } from '../components/ChecklistFields';
import type { LeaseDetail } from '../types';

const ChecklistFormSchema = z.object({
  handoverChecklist: HandoverChecklistSchema,
  returnChecklist: ReturnChecklistSchema,
});

export interface ChecklistDialogProps {
  lease: LeaseDetail;
  kind: 'handover' | 'return';
  onClose: () => void;
  onSaved: (lease: LeaseDetail) => void;
}

/** Edit the handover or the return checklist of a contract. */
export function ChecklistDialog({ lease, kind, onClose, onSaved }: ChecklistDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm(ChecklistFormSchema, {
    defaultValues: {
      handoverChecklist: { ...createHandoverChecklist(), ...(lease.handoverChecklist ?? {}) },
      returnChecklist: { ...createReturnChecklist(), ...(lease.returnChecklist ?? {}) },
    },
  });
  const { formError, handleError } = useFormErrors(form.setError);
  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof updateChecklists>[1]) => updateChecklists(lease.id, body),
    onSuccess: onSaved,
  });
  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(
        kind === 'handover'
          ? { handoverChecklist: values.handoverChecklist }
          : { returnChecklist: values.returnChecklist },
      );
    } catch (error) {
      handleError(error);
    }
  });
  return (
    <FormDialog
      open
      title={kind === 'handover' ? t('checklist.handoverTitle') : t('checklist.returnTitle')}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={760}
    >
      <ChecklistFields
        control={form.control}
        prefix={kind === 'handover' ? 'handoverChecklist' : 'returnChecklist'}
        kind={kind}
      />
    </FormDialog>
  );
}
