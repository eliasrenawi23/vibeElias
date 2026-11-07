import { Form } from 'antd';
import type { FormEventHandler, ReactNode } from 'react';

export interface FormLayoutProps {
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * A native `<form>` driven by react-hook-form, with AntD's vertical form layout for the
 * `Form*` fields (AntD's own form store is not used).
 */
export function FormLayout({ onSubmit, children, className, ...rest }: FormLayoutProps) {
  return (
    <form onSubmit={onSubmit} noValidate className={className} aria-label={rest['aria-label']}>
      <Form layout="vertical" component={false} requiredMark>
        {children}
      </Form>
    </form>
  );
}
