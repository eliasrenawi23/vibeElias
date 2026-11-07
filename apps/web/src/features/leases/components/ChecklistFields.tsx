import { FuelLevel, HANDOVER_CHECKLIST_KEYS, RETURN_CHECKLIST_KEYS } from '@renawi/shared';
import { Col, Row } from 'antd';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';

export interface ChecklistFieldsProps<T extends FieldValues, TOut> {
  control: Control<T, unknown, TOut>;
  /** Form path of the checklist object, e.g. `handoverChecklist`. */
  prefix: string;
  kind: 'handover' | 'return';
}

/**
 * Handover / return checklist inputs (shared `checklists.ts`): inspection date, odometer, fuel,
 * the yes/no items, damages and notes.
 */
export function ChecklistFields<T extends FieldValues, TOut>({
  control,
  prefix,
  kind,
}: ChecklistFieldsProps<T, TOut>) {
  const { t } = useTranslation();
  const fuelOptions = useEnumOptions('FuelLevel', FuelLevel.options);
  const keys = kind === 'handover' ? HANDOVER_CHECKLIST_KEYS : RETURN_CHECKLIST_KEYS;
  const n = (key: string) => `${prefix}.${key}` as FieldPath<T>;
  return (
    <Row gutter={16} data-testid={`checklist-${kind}`}>
      <Col xs={24} sm={8}>
        <FormDateField control={control} name={n('date')} label={t('checklist.condition.date')} />
      </Col>
      <Col xs={24} sm={8}>
        <FormNumberField
          control={control}
          name={n('km')}
          label={t('checklist.condition.km')}
          min={0}
          unit={t('units.km')}
        />
      </Col>
      <Col xs={24} sm={8}>
        <FormSelect
          control={control}
          name={n('fuelLevel')}
          label={t('checklist.condition.fuelLevel')}
          options={fuelOptions}
          allowClear
        />
      </Col>
      {keys.map((key) => (
        <Col xs={24} sm={12} md={8} key={key}>
          <FormCheckboxField
            control={control}
            name={n(key)}
            label={t(`checklist.condition.${key}`)}
          />
        </Col>
      ))}
      <Col xs={24} md={12}>
        <FormTextAreaField
          control={control}
          name={n('damages')}
          label={t('checklist.condition.damages')}
          maxLength={2000}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormTextAreaField
          control={control}
          name={n('notes')}
          label={t('checklist.condition.notes')}
          maxLength={2000}
        />
      </Col>
    </Row>
  );
}
