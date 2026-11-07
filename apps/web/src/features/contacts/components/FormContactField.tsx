import type { ContactTag } from '@renawi/shared';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from '../../../shared/ui/FieldShell';
import type { Contact } from '../types';
import { ContactPicker } from './ContactPicker';

export interface FormContactFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  tag?: ContactTag;
  /** Also called with the picked contact (e.g. to read its driver profile). */
  onPicked?: (contact: Contact | null) => void;
}

/** Contact id field (vendor, consignor...) backed by the searchable `ContactPicker`. */
export function FormContactField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  tag,
  onPicked,
}: FormContactFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <ContactPicker
        id={id}
        value={(field.value as string | null | undefined) ?? null}
        onChange={(value, contact) => {
          field.onChange(value);
          onPicked?.(contact);
        }}
        onBlur={field.onBlur}
        tag={tag}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
      />
    </FieldShell>
  );
}
