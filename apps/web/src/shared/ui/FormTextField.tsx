import { Input, type InputProps } from 'antd';
import { useId, type ChangeEvent, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { freeTextInputProps } from '../lib/bidi';
import { FieldShell } from './FieldShell';

export interface FormTextFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  type?: 'text' | 'email' | 'password';
  /**
   * Extra input props. Defaults to `dir="auto"` (free text); pass `ltrInputProps`,
   * `phoneInputProps`, `numericInputProps` or `plateInputProps` for LTR data.
   */
  inputProps?: Omit<InputProps, 'value' | 'onChange' | 'onBlur' | 'name' | 'id' | 'type'>;
}

/** Text input bound to react-hook-form with a translated validation message. */
export function FormTextField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  type = 'text',
  inputProps,
}: FormTextFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  const common = {
    id,
    name: field.name,
    ref: field.ref,
    value: (field.value as string | null | undefined) ?? '',
    onChange: (e: ChangeEvent<HTMLInputElement>) => field.onChange(e.target.value),
    onBlur: field.onBlur,
    disabled: field.disabled,
    status: fieldState.error ? ('error' as const) : undefined,
    'aria-invalid': fieldState.error ? true : undefined,
    'aria-required': required || undefined,
    ...(type === 'text' ? freeTextInputProps : { dir: 'ltr' as const }),
    ...inputProps,
  };
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      {type === 'password' ? <Input.Password {...common} /> : <Input {...common} type={type} />}
    </FieldShell>
  );
}
