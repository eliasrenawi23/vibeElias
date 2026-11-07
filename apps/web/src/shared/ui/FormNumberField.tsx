import { InputNumber } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from './FieldShell';

export interface FormNumberFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  min?: number;
  max?: number;
  /** Decimal places (default 0: whole numbers such as km, cc, year). */
  precision?: number;
  /** Unit shown inside the input (km, cc...). */
  unit?: ReactNode;
  /** Thousands separators while not editing (default true; off for years). */
  grouping?: boolean;
}

const groupFormatter = (value: number | string | undefined) =>
  value === undefined || value === '' ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const groupParser = (text: string | undefined) => Number((text ?? '').replace(/,/g, ''));

/** Number input (integers by default): left-to-right, numeric keypad; empty holds `null`. */
export function FormNumberField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  min,
  max,
  precision = 0,
  unit,
  grouping = true,
}: FormNumberFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <InputNumber<number>
        id={id}
        name={field.name}
        ref={field.ref}
        value={(field.value as number | null | undefined) ?? null}
        onChange={(value) => field.onChange(value ?? null)}
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        aria-invalid={fieldState.error ? true : undefined}
        aria-required={required || undefined}
        min={min}
        max={max}
        precision={precision}
        suffix={unit}
        formatter={grouping ? groupFormatter : undefined}
        parser={grouping ? groupParser : undefined}
        dir="ltr"
        inputMode={precision > 0 ? 'decimal' : 'numeric'}
        className="rm-tabular rm-number-input"
        controls={false}
      />
    </FieldShell>
  );
}
