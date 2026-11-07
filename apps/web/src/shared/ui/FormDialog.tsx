import { Alert, Modal } from 'antd';
import type { BaseSyntheticEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
  children,
}: FormDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
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
    </Modal>
  );
}
