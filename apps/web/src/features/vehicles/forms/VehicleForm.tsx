import { Fuel, Gearbox, VehicleOwnership, VehicleStatus, type VehicleCreate } from '@renawi/shared';
import { Alert, Button, Card, Col, Flex, Row, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWatch } from 'react-hook-form';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { ltrInputProps } from '../../../shared/lib/bidi';
import { useEnumOptions } from '../../../shared/lib/enums';
import { isTaxiPlate } from '../../../shared/lib/plate';
import { FormAutoCompleteField } from '../../../shared/ui/FormAutoCompleteField';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormPlateField } from '../../../shared/ui/FormPlateField';
import { FormSelect } from '../../../shared/ui/FormSelect';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { COMMON_MAKES } from '../lib/makes';
import type { VehicleDetail } from '../types';
import { OwnerDriverField } from './OwnerDriverField';
import {
  ownershipChoices,
  toVehicleCreateBody,
  toVehicleFormValues,
  VehicleFormSchema,
} from './vehicleFormSchema';

export interface VehicleFormProps {
  /** Existing vehicle (edit) or nothing (create). */
  vehicle?: VehicleDetail | null;
  /** Resolves when saved; rejects with the API error (field errors are mapped onto the form). */
  onSubmit: (values: VehicleCreate) => Promise<unknown>;
  submitting: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * Create / edit form of a vehicle built on the shared vehicle schema. The plate is formatted
 * while typing and suggests the taxi flag for taxi plates; the owner driver is asked for only
 * for third-party cars and the meter only for taxis.
 */
export function VehicleForm({
  vehicle,
  onSubmit,
  submitting,
  onCancel,
  submitLabel,
}: VehicleFormProps) {
  const { t } = useTranslation();
  const editing = Boolean(vehicle);
  const fuelOptions = useEnumOptions('Fuel', Fuel.options);
  const gearboxOptions = useEnumOptions('Gearbox', Gearbox.options);
  const statusOptions = useEnumOptions('VehicleStatus', VehicleStatus.options);
  const ownershipValues = useMemo(
    () => ownershipChoices(VehicleOwnership.options, vehicle?.ownership),
    [vehicle?.ownership],
  );
  const ownershipOptions = useEnumOptions('VehicleOwnership', ownershipValues);

  const form = useZodForm(VehicleFormSchema, { defaultValues: toVehicleFormValues(vehicle) });
  const { control, setValue } = form;
  const { formError, handleError, clearFormError } = useFormErrors(form.setError);
  const [plateNo, isTaxi, ownership] = useWatch({
    control,
    name: ['plateNo', 'isTaxi', 'ownership'],
  });

  // A picked contact without a driver profile blocks saving (only while THIRD_PARTY).
  const [noProfile, setNoProfile] = useState(false);
  if (ownership !== 'THIRD_PARTY' && noProfile) setNoProfile(false);
  const blocked = ownership === 'THIRD_PARTY' && noProfile;

  const submit = form.handleSubmit(async (values) => {
    if (blocked) return;
    clearFormError();
    try {
      await onSubmit(toVehicleCreateBody(values));
    } catch (error) {
      handleError(error);
    }
  });

  const taxiPlate = isTaxiPlate(plateNo ?? '');
  const plateHelp = taxiPlate ? (
    <Flex gap={4} align="center" wrap data-testid="taxi-plate-hint">
      <span>{t('vehicles.form.taxiPlateHint')}</span>
      {!isTaxi && (
        <Button
          type="link"
          size="small"
          className="rm-inline-link"
          onClick={() => setValue('isTaxi', true, { shouldDirty: true })}
        >
          {t('vehicles.form.markAsTaxi')}
        </Button>
      )}
    </Flex>
  ) : undefined;

  return (
    <FormLayout
      onSubmit={submit}
      aria-label={editing ? t('vehicles.detailTitle') : t('vehicles.newTitle')}
      className="rm-vehicle-form"
    >
      <Flex vertical gap={16}>
        {formError && <Alert type="error" showIcon title={formError} />}

        <Card title={t('vehicles.form.sections.identity')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <FormPlateField
                control={control}
                name="plateNo"
                label={t('vehicles.fields.plateNo')}
                required
                help={plateHelp}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormTextField
                control={control}
                name="vin"
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
              <FormNumberField
                control={control}
                name="year"
                label={t('vehicles.fields.year')}
                required
                grouping={false}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormAutoCompleteField
                control={control}
                name="make"
                label={t('vehicles.fields.make')}
                suggestions={COMMON_MAKES}
                required
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormTextField
                control={control}
                name="model"
                label={t('vehicles.fields.model')}
                required
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormTextField control={control} name="trim" label={t('vehicles.fields.trim')} />
            </Col>
          </Row>
        </Card>

        <Card title={t('vehicles.form.sections.specs')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <FormTextField control={control} name="color" label={t('vehicles.fields.color')} />
            </Col>
            <Col xs={12} lg={8}>
              <FormSelect
                control={control}
                name="fuel"
                label={t('vehicles.fields.fuel')}
                options={fuelOptions}
                allowClear
              />
            </Col>
            <Col xs={12} lg={8}>
              <FormSelect
                control={control}
                name="gearbox"
                label={t('vehicles.fields.gearbox')}
                options={gearboxOptions}
                allowClear
              />
            </Col>
            <Col xs={12} lg={8}>
              <FormNumberField
                control={control}
                name="engineCc"
                label={t('vehicles.fields.engineCc')}
                min={0}
                unit={t('units.cc')}
              />
            </Col>
            <Col xs={12} lg={8}>
              <FormNumberField
                control={control}
                name="hand"
                label={t('vehicles.fields.hand')}
                help={t('vehicles.form.handHelp')}
                min={0}
                max={30}
                grouping={false}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormNumberField
                control={control}
                name="currentKm"
                label={t('vehicles.fields.currentKm')}
                min={0}
                unit={t('units.km')}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('vehicles.form.sections.status')} variant="borderless">
          <Row gutter={16}>
            {!editing && (
              <Col xs={24} sm={12} lg={8}>
                <FormSelect
                  control={control}
                  name="status"
                  label={t('vehicles.fields.status')}
                  options={statusOptions}
                  help={t('vehicles.form.statusHelp')}
                  required
                />
              </Col>
            )}
            <Col xs={24} sm={12} lg={8}>
              <FormSelect
                control={control}
                name="ownership"
                label={t('vehicles.fields.ownership')}
                options={ownershipOptions}
                help={
                  ownership === 'CONSIGNED' && !vehicle?.openCycle
                    ? t('vehicles.form.consignedHelp')
                    : undefined
                }
                required
              />
            </Col>
            {ownership === 'THIRD_PARTY' && (
              <Col xs={24} sm={12} lg={8}>
                <OwnerDriverField
                  control={control}
                  current={vehicle?.ownerDriver}
                  noProfile={noProfile}
                  onNoProfileChange={setNoProfile}
                />
              </Col>
            )}
            <Col xs={24} sm={12} lg={8} className="rm-checkbox-col">
              <FormCheckboxField
                control={control}
                name="isTaxi"
                label={t('vehicles.form.isTaxiLabel')}
              />
            </Col>
          </Row>
        </Card>

        <Card title={t('vehicles.form.sections.registration')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <FormDateField
                control={control}
                name="registrationExpiry"
                label={t('vehicles.fields.registrationExpiry')}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormDateField
                control={control}
                name="dealerRegisteredAt"
                label={t('vehicles.fields.dealerRegisteredAt')}
                help={t('vehicles.form.dealerRegisteredHelp')}
              />
            </Col>
          </Row>
        </Card>

        {isTaxi && (
          <Card
            title={t('vehicles.form.sections.taxi')}
            variant="borderless"
            data-testid="taxi-meter-section"
          >
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={8}>
                <FormTextField
                  control={control}
                  name="meterSerial"
                  label={t('vehicles.fields.meterSerial')}
                  inputProps={{ ...ltrInputProps, autoComplete: 'off', className: 'rm-tabular' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <FormDateField
                  control={control}
                  name="meterSealedAt"
                  label={t('vehicles.fields.meterSealedAt')}
                />
              </Col>
            </Row>
          </Card>
        )}

        <Card title={t('vehicles.form.sections.sale')} variant="borderless">
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <FormTextField
                control={control}
                name="location"
                label={t('vehicles.fields.location')}
                help={t('vehicles.form.locationHelp')}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormMoneyField
                control={control}
                name="listingPrice"
                label={t('vehicles.fields.listingPrice')}
                min={0}
                precision={0}
              />
            </Col>
            <Col xs={24}>
              <FormTextAreaField
                control={control}
                name="notes"
                label={t('vehicles.fields.notes')}
                maxLength={5000}
              />
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" align="center" wrap className="rm-form-actions">
          {blocked && (
            <Typography.Text type="warning">{t('vehicles.form.saveBlocked')}</Typography.Text>
          )}
          {onCancel && (
            <Button onClick={onCancel} disabled={submitting}>
              {t('actions.cancel')}
            </Button>
          )}
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            disabled={blocked}
            data-testid="vehicle-save"
          >
            {submitLabel ?? t('actions.save')}
          </Button>
        </Flex>
      </Flex>
    </FormLayout>
  );
}
