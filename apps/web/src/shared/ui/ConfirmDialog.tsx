import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  /** Body text; defaults to the generic "are you sure" message. */
  content?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Controlled confirmation modal with translated buttons. */
export function ConfirmDialog({
  open,
  title,
  content,
  confirmText,
  cancelText,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText ?? t('actions.confirm')}
      cancelText={cancelText ?? t('actions.cancel')}
      okButtonProps={{ danger, loading }}
      onOk={onConfirm}
      onCancel={onCancel}
      destroyOnHidden
    >
      {content ?? t('common.confirmDelete')}
    </Modal>
  );
}
