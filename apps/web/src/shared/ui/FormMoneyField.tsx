import { InputNumber } from 'antd';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from './FieldShell';

export interface FormMoneyFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  /** Unit shown inside the input; defaults to `₪`. Pass e.g. `%` for rates. */
  unit?: ReactNode;
  min?: number;
  max?: number;
  /** Decimal places (default 2, the money precision of the API). */
  precision?: number;
}

/**
 * Number input for amounts (and rates): always left-to-right with tabular figures and the
 * decimal keypad on phones. An empty input holds `null`.
 */
export function FormMoneyField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  unit,
  min,
  max,
  precision = 2,
}: FormMoneyFieldProps<T, TOut>) {
  const { t } = useTranslation();
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
        suffix={unit ?? t('money.currencySymbol')}
        dir="ltr"
        inputMode="decimal"
        className="rm-tabular rm-number-input"
        controls={false}
      />
    </FieldShell>
  );
}
