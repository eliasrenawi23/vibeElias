import { Input } from 'antd';
import { useId, type ChangeEvent, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { formatPlate, normalizePlateInput, plateInputProps } from '../lib/plate';
import { FieldShell } from './FieldShell';

export interface FormPlateFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
}

/** Digits only (Arabic-Indic converted), at most 8, formatted as `12-345-67` / `123-45-678`. */
export function formatPlateTyping(input: string): string {
  const digits = normalizePlateInput(input).replace(/\D/g, '').slice(0, 8);
  return formatPlate(digits);
}

/**
 * Licence plate input: always left-to-right with the numeric keypad, formatted while typing.
 * The form value is the formatted text; the shared `plateNo` schema outputs canonical digits.
 */
export function FormPlateField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
}: FormPlateFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <Input
        id={id}
        name={field.name}
        ref={field.ref}
        value={(field.value as string | null | undefined) ?? ''}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          field.onChange(formatPlateTyping(e.target.value))
        }
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        aria-invalid={fieldState.error ? true : undefined}
        aria-required={required || undefined}
        className="rm-plate-input rm-tabular"
        maxLength={10}
        {...plateInputProps}
      />
    </FieldShell>
  );
}
