import { Alert, Modal } from 'antd';
import { useState, type BaseSyntheticEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './ConfirmDialog';
import { FormLayout } from './FormLayout';

export interface FormDialogProps {
  open: boolean;
  title: ReactNode;
  /** `form.handleSubmit(...)` result. */
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  okText?: ReactNode;
  okDanger?: boolean;
  /** Disable the OK button (e.g. nothing can be submitted). */
  okDisabled?: boolean;
  /** Form-level error (API message that is not tied to a field). */
  error?: ReactNode;
  width?: number;
  /** The form has unsaved input (`form.formState.isDirty`): closing asks to discard it. */
  dirty?: boolean;
  children: ReactNode;
}

/** Modal hosting a react-hook-form form; the OK button submits it. Unmounts its content on close. */
export function FormDialog({
  open,
  title,
  onSubmit,
  onCancel,
  submitting = false,
  okText,
  okDanger = false,
  okDisabled = false,
  error,
  width = 560,
  dirty = false,
  children,
}: FormDialogProps) {
  const { t } = useTranslation();
  const [confirmClose, setConfirmClose] = useState(false);
  const close = () => {
    if (dirty && !submitting) setConfirmClose(true);
    else onCancel();
  };
  return (
    <Modal
      open={open}
      title={title}
      onCancel={close}
      onOk={() => {
        if (!okDisabled) void onSubmit();
      }}
      okText={okText ?? t('actions.save')}
      cancelText={t('actions.cancel')}
      okButtonProps={{ loading: submitting, danger: okDanger, disabled: okDisabled }}
      destroyOnHidden
      width={width}
    >
      {error && <Alert type="error" showIcon title={error} className="rm-dialog-error" />}
      <FormLayout onSubmit={onSubmit}>
        {children}
        {/* Lets Enter in any input submit the form. */}
        <button type="submit" tabIndex={-1} aria-hidden className="rm-visually-hidden" />
      </FormLayout>
      <ConfirmDialog
        open={confirmClose}
        title={t('unsaved.title')}
        content={t('unsaved.close')}
        confirmText={t('unsaved.discard')}
        cancelText={t('unsaved.stay')}
        danger
        onConfirm={() => {
          setConfirmClose(false);
          onCancel();
        }}
        onCancel={() => setConfirmClose(false)}
      />
    </Modal>
  );
}
