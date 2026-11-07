import { Form } from 'antd';
import type { ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { useDynamicT } from '../lib/i18n';

export interface FieldShellProps {
  id: string;
  label: ReactNode;
  required?: boolean;
  /** Helper text shown when there is no error. */
  help?: ReactNode;
  error?: FieldError;
  children: ReactNode;
}

/** AntD `Form.Item` chrome (label, required mark, translated error) around an input. */
export function FieldShell({ id, label, required, help, error, children }: FieldShellProps) {
  const dynamicT = useDynamicT();
  const message = error?.message ? dynamicT(error.message, 'validation.invalidValue') : undefined;
  return (
    <Form.Item
      label={label}
      htmlFor={id}
      required={required}
      validateStatus={message ? 'error' : undefined}
      help={message ?? help}
    >
      {children}
    </Form.Item>
  );
}
