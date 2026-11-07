import { Checkbox, Form } from 'antd';
import type { ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useDynamicT } from '../lib/i18n';

export interface FormCheckboxFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  help?: ReactNode;
}

/** Boolean field as a labelled checkbox. */
export function FormCheckboxField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  help,
}: FormCheckboxFieldProps<T, TOut>) {
  const dynamicT = useDynamicT();
  const { field, fieldState } = useController({ control, name });
  const message = fieldState.error?.message
    ? dynamicT(fieldState.error.message, 'validation.invalidValue')
    : undefined;
  return (
    <Form.Item validateStatus={message ? 'error' : undefined} help={message ?? help}>
      <Checkbox
        name={field.name}
        ref={field.ref}
        checked={Boolean(field.value)}
        onChange={(e) => field.onChange(e.target.checked)}
        onBlur={field.onBlur}
        disabled={field.disabled}
      >
        {label}
      </Checkbox>
    </Form.Item>
  );
}
