import { Form, Radio } from 'antd';
import { useId, type ReactNode } from 'react';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useDynamicT } from '../lib/i18n';

export interface FormRadioOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface FormRadioFieldProps<T extends FieldValues, TOut = T> {
  control: Control<T, unknown, TOut>;
  name: FieldPath<T>;
  label: ReactNode;
  options: FormRadioOption[];
  required?: boolean;
  help?: ReactNode;
  /** `button` renders a segmented button group (short option lists). */
  optionType?: 'default' | 'button';
  /** Stack the options vertically. */
  vertical?: boolean;
}

/** A small set of mutually exclusive options as a radio group. */
export function FormRadioField<T extends FieldValues, TOut = T>({
  control,
  name,
  label,
  options,
  required,
  help,
  optionType = 'default',
  vertical = false,
}: FormRadioFieldProps<T, TOut>) {
  const id = useId();
  const dynamicT = useDynamicT();
  const { field, fieldState } = useController({ control, name });
  const message = fieldState.error?.message
    ? dynamicT(fieldState.error.message, 'validation.invalidValue')
    : undefined;
  return (
    <Form.Item
      label={<span id={id}>{label}</span>}
      required={required}
      validateStatus={message ? 'error' : undefined}
      help={message ?? help}
    >
      <Radio.Group
        name={field.name}
        value={(field.value as string | null | undefined) ?? undefined}
        onChange={(e) => field.onChange(e.target.value)}
        disabled={field.disabled}
        optionType={optionType}
        buttonStyle={optionType === 'button' ? 'solid' : undefined}
        options={options}
        orientation={vertical ? 'vertical' : 'horizontal'}
        aria-labelledby={id}
        data-testid={`field-${field.name}`}
      />
    </Form.Item>
  );
}
