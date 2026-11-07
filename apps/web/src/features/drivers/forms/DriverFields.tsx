import { DriverStatus } from '@renawi/shared';
import { Col, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { numericInputProps, phoneInputProps } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import type { DriverFieldsInput } from './driverFormSchema';

export interface DriverFieldsProps<T extends FieldValues, TOut> {
  /** A form whose values include the driver columns (`DriverFieldsInput`). */
  control: Control<T, unknown, TOut>;
  /** Show the status select (edit). */
  showStatus?: boolean;
}

/** Driver licence, taxi permit, medical, emergency contact, start date and notes. */
export function DriverFields<T extends FieldValues, TOut>({
  control,
  showStatus = false,
}: DriverFieldsProps<T, TOut>) {
  const { t } = useTranslation();
  const statusOptions = useEnumOptions('DriverStatus', DriverStatus.options);
  const n = (key: keyof DriverFieldsInput) => key as FieldPath<T>;
  return (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <FormTextField
          control={control}
          name={n('licenseNo')}
          label={t('drivers.fields.licenseNo')}
          inputProps={{ ...numericInputProps, inputMode: 'text' }}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormDateField
          control={control}
          name={n('licenseExpiry')}
          label={t('drivers.fields.licenseExpiry')}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormTextField
          control={control}
          name={n('taxiPermitNo')}
          label={t('drivers.fields.taxiPermitNo')}
          inputProps={{ ...numericInputProps, inputMode: 'text' }}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormDateField
          control={control}
          name={n('taxiPermitExpiry')}
          label={t('drivers.fields.taxiPermitExpiry')}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormDateField
          control={control}
          name={n('medicalExpiry')}
          label={t('drivers.fields.medicalExpiry')}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormDateField
          control={control}
          name={n('startedAt')}
          label={t('drivers.fields.startedAt')}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormTextField
          control={control}
          name={n('emergencyName')}
          label={t('drivers.fields.emergencyName')}
        />
      </Col>
      <Col xs={24} md={12}>
        <FormTextField
          control={control}
          name={n('emergencyPhone')}
          label={t('drivers.fields.emergencyPhone')}
          inputProps={phoneInputProps}
        />
      </Col>
      {showStatus && (
        <Col xs={24} md={12}>
          <FormSelect
            control={control}
            name={n('status')}
            label={t('common.status')}
            options={statusOptions}
            required
          />
        </Col>
      )}
      <Col xs={24}>
        <FormTextAreaField control={control} name={n('notes')} label={t('common.notes')} />
      </Col>
    </Row>
  );
}
