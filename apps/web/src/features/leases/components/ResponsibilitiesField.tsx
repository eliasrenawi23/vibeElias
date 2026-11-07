import {
  DEFAULT_RESPONSIBILITIES,
  RESPONSIBILITY_KEYS,
  type Responsibilities,
  type ResponsibleParty,
} from '@renawi/shared';
import { Flex, Form, Segmented, Typography } from 'antd';
import { useController, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useEnumLabel } from '../../../shared/lib/enums';

export interface ResponsibilitiesFieldProps<T extends FieldValues, TOut> {
  control: Control<T, unknown, TOut>;
  /** Form path of the `{ insurance, test, repairs, fines }` object. */
  name: FieldPath<T>;
}

/** Who pays insurance, the annual test, repairs and fines: one driver / us toggle each. */
export function ResponsibilitiesField<T extends FieldValues, TOut>({
  control,
  name,
}: ResponsibilitiesFieldProps<T, TOut>) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const { field } = useController({ control, name });
  const value = (field.value as Responsibilities | undefined) ?? DEFAULT_RESPONSIBILITIES;
  const options = (['DRIVER', 'US'] as const).map((p) => ({
    value: p,
    label: enumLabel('ResponsibleParty', p),
  }));
  return (
    <Form.Item
      label={t('leases.fields.responsibilities')}
      help={t('leases.form.responsibilitiesHelp')}
    >
      <Flex vertical gap={8} data-testid="responsibilities">
        {RESPONSIBILITY_KEYS.map((key) => (
          <Flex
            key={key}
            align="center"
            justify="space-between"
            gap={12}
            wrap
            className="rm-responsibility-row"
          >
            <Typography.Text id={`resp-${key}`}>{t(`responsibility.${key}`)}</Typography.Text>
            <Segmented<ResponsibleParty>
              value={value[key]}
              options={options}
              onChange={(party) => field.onChange({ ...value, [key]: party })}
              aria-labelledby={`resp-${key}`}
              data-testid={`responsibility-${key}`}
            />
          </Flex>
        ))}
      </Flex>
    </Form.Item>
  );
}
