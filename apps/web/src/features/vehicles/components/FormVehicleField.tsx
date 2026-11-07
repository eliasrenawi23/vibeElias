import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { FieldShell } from '../../../shared/ui/FieldShell';
import type { VehicleListItem } from '../types';
import { VehiclePicker, type VehiclePickerProps } from './VehiclePicker';

export interface FormVehicleFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  required?: boolean;
  help?: ReactNode;
  filters?: VehiclePickerProps['filters'];
  isDisabled?: VehiclePickerProps['isDisabled'];
  placeholder?: string;
  /** Also called with the picked vehicle (list item), or null when cleared. */
  onPicked?: (vehicle: VehicleListItem | null) => void;
  'data-testid'?: string;
}

/** Vehicle id field backed by the searchable `VehiclePicker`. */
export function FormVehicleField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  required,
  help,
  filters,
  isDisabled,
  placeholder,
  onPicked,
  'data-testid': testId,
}: FormVehicleFieldProps<T, TOut>) {
  const id = useId();
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldShell id={id} label={label} required={required} help={help} error={fieldState.error}>
      <VehiclePicker
        id={id}
        value={(field.value as string | null | undefined) ?? null}
        onChange={(value, vehicle) => {
          field.onChange(value);
          onPicked?.(vehicle);
        }}
        onBlur={field.onBlur}
        filters={filters}
        isDisabled={isDisabled}
        placeholder={placeholder}
        disabled={field.disabled}
        status={fieldState.error ? 'error' : undefined}
        data-testid={testId}
      />
    </FieldShell>
  );
}
