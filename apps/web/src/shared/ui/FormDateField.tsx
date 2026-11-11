import { DatePicker } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { DATE_INPUT_FORMATS, dayjsToIso, isoToDayjs } from '../lib/dates';
import { FieldShell } from './FieldShell';

/** Shown as the first, accepted typed or pasted in any of them. */
const FORMATS = [...DATE_INPUT_FORMATS];

export interface FormDateFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  allowClear?: boolean;
}

/** Calendar-date picker; the form value is a `YYYY-MM-DD` string (null when cleared). */
export function FormDateField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  allowClear = true,
}: FormDateFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <DatePicker
        id={id}
        name={field.name}
        ref={field.ref}
        value={isoToDayjs(field.value as string | null | undefined)}
        onChange={(value) => field.onChange(dayjsToIso(value))}
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        format={FORMATS}
        allowClear={allowClear}
        className="rm-tabular rm-date-input"
      />
    </FieldShell>
  );
}
