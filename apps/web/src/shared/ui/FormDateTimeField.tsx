import { DatePicker } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  businessWallTimeToIso,
  DATE_TIME_INPUT_FORMATS,
  isoToBusinessWallTime,
} from '../lib/dates';
import { FieldShell } from './FieldShell';

/** Shown as the first, accepted typed or pasted in any of them. */
const FORMATS = [...DATE_TIME_INPUT_FORMATS];

export interface FormDateTimeFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  allowClear?: boolean;
}

/**
 * Date + time picker (24 h). The time is read as wall-clock time in the business time zone and
 * the form value is the ISO instant (`2026-11-05T12:30:00.000Z`), null when cleared.
 */
export function FormDateTimeField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  allowClear = true,
}: FormDateTimeFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <DatePicker
        id={id}
        name={field.name}
        ref={field.ref}
        showTime={{ format: 'HH:mm' }}
        needConfirm={false}
        value={isoToBusinessWallTime(field.value as string | null | undefined)}
        onChange={(value) => field.onChange(businessWallTimeToIso(value))}
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
