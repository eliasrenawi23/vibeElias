import { Select } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from './FieldShell';

export interface FormSelectOption {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

export interface FormSelectProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  options: FormSelectOption[];
  required?: boolean;
  help?: ReactNode;
  allowClear?: boolean;
  placeholder?: ReactNode;
  mode?: 'multiple';
}

/** Select bound to react-hook-form; a cleared single select holds `null`. */
export function FormSelect<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  options,
  required,
  help,
  allowClear,
  placeholder,
  mode,
}: FormSelectProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <Select
        id={id}
        ref={field.ref}
        value={field.value ?? (mode ? [] : undefined)}
        onChange={(value: unknown) => field.onChange(value ?? null)}
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        options={options}
        allowClear={allowClear}
        placeholder={placeholder}
        mode={mode}
        showSearch={options.length > 8 ? { optionFilterProp: 'label' } : false}
        data-testid={`field-${field.name}`}
      />
    </FieldShell>
  );
}
