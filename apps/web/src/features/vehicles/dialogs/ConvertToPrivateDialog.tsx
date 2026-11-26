import { todayInBusinessTz, VehicleConvertSchema, type VehicleConvert } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Col, Row, Typography } from 'antd';
import { useEffect } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { formatAmount } from '../../../shared/lib/money';
import { isTaxiPlate } from '../../../shared/lib/plate';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormDialog } from '../../../shared/ui/FormDialog';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormPlateField } from '../../../shared/ui/FormPlateField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { FormContactField } from '../../contacts/components/FormContactField';
import { convertToPrivate } from '../api';
import { ConversionBlockers } from '../components/ConversionBlockers';
import type { VehicleDetail } from '../types';

export interface ConvertToPrivateDialogProps {
  vehicle: VehicleDetail;
  onClose: () => void;
  /** Receives the updated vehicle file returned by the API. */
  onSaved: (vehicle: VehicleDetail) => void;
}

const FIELDS = ['convertedAt', 'newPlateNo', 'conversionTax', 'listingPrice', 'vendorId', 'notes'];

/**
 * Convert a taxi into a private car (`POST /vehicles/:id/convert-to-private`): date, the new
 * (private) plate, the customs paid and the new asking price (taxi price + customs, until edited).
 */
export function ConvertToPrivateDialog({ vehicle, onClose, onSaved }: ConvertToPrivateDialogProps) {
  const { t, i18n } = useTranslation();
  const taxiPrice = vehicle.listingPrice;
  const expectedTax = vehicle.expectedConversionTax ?? 0;
  const blocked =
    (vehicle.canConvert?.blockers.length ?? 0) > 0 || vehicle.canConvert?.allowed === false;

  const form = useZodForm(VehicleConvertSchema, {
    defaultValues: {
      convertedAt: todayInBusinessTz(),
      newPlateNo: '',
      conversionTax: expectedTax,
      listingPrice: taxiPrice !== null ? taxiPrice + expectedTax : null,
      vendorId: null,
      notes: '',
    },
  });
  const { control, setValue, formState } = form;
  const { formError, handleError } = useFormErrors(form.setError, { fields: FIELDS });
  const [newPlateNo, customs] = useWatch({ control, name: ['newPlateNo', 'conversionTax'] });
  const priceEdited = Boolean(formState.dirtyFields.listingPrice);

  // The asking price follows "taxi price + customs" until the user types a price of their own.
  useEffect(() => {
    if (priceEdited || taxiPrice === null) return;
    setValue('listingPrice', taxiPrice + (Number(customs) || 0));
  }, [customs, priceEdited, taxiPrice, setValue]);

  const mutation = useMutation({
    mutationFn: (body: VehicleConvert) => convertToPrivate(vehicle.id, body),
    onSuccess: onSaved,
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      handleError(error);
    }
  });

  const money = (amount: number) =>
    isolateLtr(formatAmount(amount, i18n.resolvedLanguage, { decimals: false }));
  const customsAmount = Number(customs) || 0;

  return (
    <FormDialog
      open
      dirty={formState.isDirty}
      title={t('vehicles.convert.title')}
      okText={t('vehicles.convert.submit')}
      okDisabled={blocked}
      onSubmit={submit}
      onCancel={onClose}
      submitting={mutation.isPending}
      error={formError}
      width={640}
    >
      <div data-testid="convert-dialog">
        {blocked ? (
          <ConversionBlockers vehicle={vehicle} />
        ) : (
          <Typography.Paragraph type="secondary">
            {t('vehicles.convert.intro')}
          </Typography.Paragraph>
        )}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <FormDateField
              control={control}
              name="convertedAt"
              label={t('vehicles.convert.date')}
              required
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormPlateField
              control={control}
              name="newPlateNo"
              label={t('vehicles.convert.newPlate')}
              required
              help={
                isTaxiPlate(newPlateNo ?? '') ? (
                  <Typography.Text type="warning" data-testid="convert-taxi-plate-warning">
                    {t('vehicles.convert.taxiPlateWarning')}
                  </Typography.Text>
                ) : undefined
              }
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormMoneyField
              control={control}
              name="conversionTax"
              label={t('vehicles.convert.customs')}
              help={t('vehicles.convert.customsHelp')}
              required
              min={0}
              precision={0}
            />
          </Col>
          <Col xs={24} sm={12}>
            <FormMoneyField
              control={control}
              name="listingPrice"
              label={t('vehicles.convert.newPrice')}
              help={t('vehicles.convert.newPriceHelp')}
              min={0}
              precision={0}
            />
          </Col>
          <Col xs={24}>
            <FormContactField
              control={control}
              name="vendorId"
              label={t('vehicles.convert.vendor')}
            />
          </Col>
          <Col xs={24}>
            <FormTextAreaField
              control={control}
              name="notes"
              label={t('vehicles.convert.notes')}
              maxLength={1000}
            />
          </Col>
        </Row>
        {taxiPrice !== null && (
          <Alert
            type="info"
            data-testid="convert-summary"
            title={t('vehicles.convert.summary', {
              taxi: money(taxiPrice),
              customs: money(customsAmount),
              total: money(taxiPrice + customsAmount),
            })}
          />
        )}
      </div>
    </FormDialog>
  );
}
