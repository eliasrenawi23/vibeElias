import { AutoComplete } from 'antd';
import { useId, useMemo, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from './FieldShell';

export interface FormAutoCompleteFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  /** Suggestions; any other text is accepted too. */
  suggestions: readonly string[];
  required?: boolean;
  help?: ReactNode;
}

/** Free text with suggestions (e.g. car makes). */
export function FormAutoCompleteField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  suggestions,
  required,
  help,
}: FormAutoCompleteFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  const value = (field.value as string | null | undefined) ?? '';
  const needle = value.trim().toLowerCase();
  const options = useMemo(
    () =>
      suggestions
        .filter((s) => !needle || s.toLowerCase().includes(needle))
        .map((s) => ({ value: s, label: s })),
    [suggestions, needle],
  );
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <AutoComplete
        id={id}
        ref={field.ref}
        value={value}
        options={options}
        onChange={(v: string) => field.onChange(v ?? '')}
        onBlur={field.onBlur}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        aria-invalid={fieldState.error ? true : undefined}
        aria-required={required || undefined}
        data-testid={`field-${field.name}`}
      />
    </FieldShell>
  );
}
