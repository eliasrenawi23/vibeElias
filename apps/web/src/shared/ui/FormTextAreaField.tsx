import { Input } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from './FieldShell';

export interface FormTextAreaFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
}

/** Multi-line free text (notes, descriptions); direction follows what is typed. */
export function FormTextAreaField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  minRows = 2,
  maxRows = 8,
  maxLength,
}: FormTextAreaFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <Input.TextArea
        id={id}
        name={field.name}
        ref={field.ref}
        value={(field.value as string | null | undefined) ?? ''}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        aria-invalid={fieldState.error ? true : undefined}
        autoSize={{ minRows, maxRows }}
        maxLength={maxLength}
        dir="auto"
      />
    </FieldShell>
  );
}
