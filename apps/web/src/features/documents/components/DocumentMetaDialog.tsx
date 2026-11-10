import { DocKind, DocumentUpdateSchema } from '@renawi/shared';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { AutoDir } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextField } from '../../../shared/ui/FormTextField';

/** Kind (required), title and expiry: the metadata typed in the upload and edit dialogs. */
export const DocumentMetaSchema = DocumentUpdateSchema.pick({
  kind: true,
  title: true,
  expiresAt: true,
}).required({ kind: true });
export type DocumentMetaInput = z.input<typeof DocumentMetaSchema>;
export type DocumentMeta = z.output<typeof DocumentMetaSchema>;

/** Inputs of the dialog; API errors on other paths (`file`, the owner id) go to the alert. */
const META_FIELDS = ['kind', 'title', 'expiresAt'] as const;

export interface DocumentMetaDialogProps {
  mode: 'upload' | 'edit';
  /** Name of the chosen / stored file, shown for reference. */
  fileName: string;
  initial: { kind: DocKind; title?: string | null; expiresAt?: string | null };
  kinds?: readonly DocKind[];
  submitting: boolean;
  /** Resolves when saved; rejects with the API error. */
  onSubmit: (meta: DocumentMeta) => Promise<unknown>;
  onCancel: () => void;
}

/** Upload / edit dialog: document type, optional title and optional expiry date. */
export function DocumentMetaDialog({
  mode,
  fileName,
  initial,
  kinds,
  submitting,
  onSubmit,
  onCancel,
}: DocumentMetaDialogProps) {
  const { t } = useTranslation();
  const kindOptions = useEnumOptions('DocKind', kinds ?? DocKind.options);
  const form = useZodForm(DocumentMetaSchema, {
    defaultValues: {
      kind: initial.kind,
      title: initial.title ?? '',
      expiresAt: initial.expiresAt ?? null,
    },
  });
  const { formError, handleError } = useFormErrors(form.setError, { fields: META_FIELDS });

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormDialog
      open
      dirty={form.formState.isDirty}
      title={mode === 'upload' ? t('documents.uploadTitle') : t('documents.editTitle')}
      okText={mode === 'upload' ? t('actions.upload') : t('actions.save')}
      onSubmit={submit}
      onCancel={onCancel}
      submitting={submitting}
      error={formError}
    >
      <Typography.Paragraph type="secondary" className="rm-doc-dialog-file">
        {t('documents.file')}: <AutoDir>{fileName}</AutoDir>
      </Typography.Paragraph>
      <FormSelect
        control={form.control}
        name="kind"
        label={t('documents.kind')}
        options={kindOptions}
        required
      />
      <FormTextField control={form.control} name="title" label={t('documents.docTitle')} />
      <FormDateField control={form.control} name="expiresAt" label={t('documents.expiresAt')} />
    </FormDialog>
  );
}
