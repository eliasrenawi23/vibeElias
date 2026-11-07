import { Fuel, Gearbox } from '@renawi/shared';
import { Button, Col, Flex, Form, Row, Segmented } from 'antd';
import { useController, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ltrInputProps } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { isTaxiPlate } from '../../../shared/lib/plate';
import { FormAutoCompleteField } from '../../../shared/ui/FormAutoCompleteField';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormPlateField } from '../../../shared/ui/FormPlateField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { FormVehicleField } from '../../vehicles/components/FormVehicleField';
import { COMMON_MAKES } from '../../vehicles/lib/makes';
import type { DealCreateBody } from '../types';
import type { DealFormValues, VehicleMode } from './dealFormSchema';

/** Statuses of cars that can be bought (again): outside the stock, returned, or sold (buy-back). */
export const PURCHASE_CANDIDATE_FILTERS = { status: 'EXTERNAL,RETURNED,SOLD' } as const;

type ChoicePrefix = 'vehicle' | 'tradeIn.vehicle';

export interface VehicleChoiceFieldsProps {
  control: Control<DealFormValues, unknown, DealCreateBody>;
  /** `vehicle` (purchase) or `tradeIn.vehicle` (trade-in of a sale). */
  prefix: ChoicePrefix;
  /** Test id prefix (`purchase-vehicle`, `trade-in-vehicle`). */
  testId: string;
}

/**
 * The car of a purchase or a trade-in: a car already in the system (search by plate among cars
 * outside the stock, returned or sold earlier) or a new car typed inline.
 */
export function VehicleChoiceFields({ control, prefix, testId }: VehicleChoiceFieldsProps) {
  const { t } = useTranslation();
  const { field: modeField } = useController({ control, name: `${prefix}.mode` });
  const mode = modeField.value as VehicleMode;

  return (
    <Flex vertical gap={4}>
      <Form.Item>
        <Segmented<VehicleMode>
          value={mode}
          onChange={(v) => modeField.onChange(v)}
          options={[
            { value: 'existing', label: t('deals.form.existingVehicle') },
            { value: 'new', label: t('deals.form.newVehicle') },
          ]}
          data-testid={`${testId}-mode`}
        />
      </Form.Item>
      {mode === 'existing' ? (
        <FormVehicleField
          control={control}
          name={`${prefix}.id`}
          label={t('deals.fields.vehicle')}
          required
          help={t('deals.form.purchasePickerHelp')}
          filters={PURCHASE_CANDIDATE_FILTERS}
          data-testid={`${testId}-picker`}
        />
      ) : (
        <InlineVehicleFields control={control} prefix={prefix} />
      )}
    </Flex>
  );
}

/** Plate, make, model, trim, year, km, hand, fuel, gearbox, colour, VIN and licence expiry. */
function InlineVehicleFields({
  control,
  prefix,
}: {
  control: Control<DealFormValues, unknown, DealCreateBody>;
  prefix: ChoicePrefix;
}) {
  const { t } = useTranslation();
  const fuelOptions = useEnumOptions('Fuel', Fuel.options);
  const gearboxOptions = useEnumOptions('Gearbox', Gearbox.options);
  const base = `${prefix}.create` as const;
  const [plateNo, isTaxi] = useWatch({
    control,
    name: [`${base}.plateNo`, `${base}.isTaxi`],
  });
  const { field: taxiField } = useController({ control, name: `${base}.isTaxi` });
  const plateHelp =
    isTaxiPlate(String(plateNo ?? '')) && !isTaxi ? (
      <Flex gap={4} align="center" wrap>
        <span>{t('vehicles.form.taxiPlateHint')}</span>
        <Button
          type="link"
          size="small"
          className="rm-inline-link"
          onClick={() => taxiField.onChange(true)}
        >
          {t('vehicles.form.markAsTaxi')}
        </Button>
      </Flex>
    ) : undefined;

  return (
    <Row gutter={16} data-testid={`${prefix}-inline`}>
      <Col xs={24} sm={12} lg={8}>
        <FormPlateField
          control={control}
          name={`${base}.plateNo`}
          label={t('vehicles.fields.plateNo')}
          required
          help={plateHelp}
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <FormAutoCompleteField
          control={control}
          name={`${base}.make`}
          label={t('vehicles.fields.make')}
          suggestions={COMMON_MAKES}
          required
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <FormTextField
          control={control}
          name={`${base}.model`}
          label={t('vehicles.fields.model')}
          required
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <FormTextField control={control} name={`${base}.trim`} label={t('vehicles.fields.trim')} />
      </Col>
      <Col xs={12} lg={8}>
        <FormNumberField
          control={control}
          name={`${base}.year`}
          label={t('vehicles.fields.year')}
          required
          grouping={false}
        />
      </Col>
      <Col xs={12} lg={8}>
        <FormNumberField
          control={control}
          name={`${base}.currentKm`}
          label={t('vehicles.fields.currentKm')}
          min={0}
          unit={t('units.km')}
        />
      </Col>
      <Col xs={12} lg={8}>
        <FormNumberField
          control={control}
          name={`${base}.hand`}
          label={t('vehicles.fields.hand')}
          min={0}
          max={30}
          grouping={false}
        />
      </Col>
      <Col xs={12} lg={8}>
        <FormSelect
          control={control}
          name={`${base}.fuel`}
          label={t('vehicles.fields.fuel')}
          options={fuelOptions}
          allowClear
        />
      </Col>
      <Col xs={12} lg={8}>
        <FormSelect
          control={control}
          name={`${base}.gearbox`}
          label={t('vehicles.fields.gearbox')}
          options={gearboxOptions}
          allowClear
        />
      </Col>
      <Col xs={12} lg={8}>
        <FormTextField
          control={control}
          name={`${base}.color`}
          label={t('vehicles.fields.color')}
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <FormTextField
          control={control}
          name={`${base}.vin`}
          label={t('vehicles.fields.vin')}
          inputProps={{
            ...ltrInputProps,
            autoCapitalize: 'characters',
            autoComplete: 'off',
            maxLength: 24,
            className: 'rm-tabular',
          }}
        />
      </Col>
      <Col xs={24} sm={12} lg={8}>
        <FormDateField
          control={control}
          name={`${base}.registrationExpiry`}
          label={t('vehicles.fields.registrationExpiry')}
        />
      </Col>
      <Col xs={24} sm={12} lg={8} className="rm-checkbox-col">
        <FormCheckboxField
          control={control}
          name={`${base}.isTaxi`}
          label={t('vehicles.form.isTaxiLabel')}
        />
      </Col>
    </Row>
  );
}
