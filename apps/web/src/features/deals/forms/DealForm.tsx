import { todayInBusinessTz, type DealType } from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Descriptions, Flex, Row, Switch, Typography } from 'antd';
import { useEffect, useMemo } from 'react';
import { useController, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useUnsavedChangesGuard } from '../../../shared/form/useUnsavedChangesGuard';
import { isolateLtr } from '../../../shared/lib/bidi';
import { formatCount } from '../../../shared/lib/money';
import { DateText } from '../../../shared/ui/DateText';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormRadioField } from '../../../shared/ui/FormRadioField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { Money } from '../../../shared/ui/Money';
import { ContactLink } from '../../contacts/components/ContactLink';
import { FormContactField } from '../../contacts/components/FormContactField';
import { FormVehicleField } from '../../vehicles/components/FormVehicleField';
import type { InventoryCycle, VehicleDetail } from '../../vehicles/types';
import { createDeal } from '../api';
import { CommissionRuleText } from '../components/CommissionRuleText';
import { ListGapText } from '../components/DealBits';
import {
  cashDue,
  commissionPreview,
  computeSaleVat,
  counterpartyLabelKey,
  daysInStock,
} from '../lib/dealRules';
import { useCyclePurchase, useVatRate, useVehicleFile } from '../lib/useDealData';
import type { DealCreateBody, DealDetail, DealListItem } from '../types';
import {
  DEAL_FORM_FIELDS,
  dealFormResolver,
  defaultDealValues,
  type DealFormValues,
} from './dealFormSchema';
import { VehicleChoiceFields } from './VehicleChoiceFields';
import { DESCRIPTION_COLUMNS } from '../../../shared/ui/descriptionColumns';

type FormControl = Control<DealFormValues, unknown, DealCreateBody>;

/** Cars that can be sold: our stock with an open (OWNED) inventory cycle. */
const SALE_FILTERS = { status: 'IN_STOCK,RESERVED', ownership: 'OWNED' } as const;
/** Consignment cars in stock (an open CONSIGNED cycle). */
const CONSIGNMENT_FILTERS = { status: 'IN_STOCK,RESERVED', ownership: 'CONSIGNED' } as const;
const noOpenCycle = (v: { openCycle: unknown }) => !v.openCycle;

export interface DealFormProps {
  type: DealType;
  /** Preselected car (`?vehicleId=`). */
  initialVehicleId?: string | null;
  onCreated: (deal: DealDetail) => void;
  onCancel: () => void;
}

/**
 * New purchase / sale / consignment sale. One form with type-specific sections: the car (picked
 * or typed inline), the counterparty and price with the gap to the price guide, then VAT and the
 * trade-in (sale) or the commission preview (consignment), warranty and notes.
 */
export function DealForm({ type, initialVehicleId, onCreated, onCancel }: DealFormProps) {
  const { t, i18n } = useTranslation();
  const defaultWarranty = useMemo(() => i18n.getFixedT('he')('deals.defaultWarranty'), [i18n]);
  const form = useForm<DealFormValues, unknown, DealCreateBody>({
    mode: 'onTouched',
    resolver: dealFormResolver,
    defaultValues: defaultDealValues({
      type,
      vehicleId: initialVehicleId,
      today: todayInBusinessTz(),
      warrantyText: defaultWarranty,
    }),
  });
  const { control } = form;
  const { formError, handleError, clearFormError } = useFormErrors(form.setError, {
    fields: DEAL_FORM_FIELDS,
  });
  const mutation = useMutation({ mutationFn: createDeal, onSuccess: onCreated });

  const vehicleId = useWatch({ control, name: 'vehicleId' });
  const [price, listPrice] = useWatch({ control, name: ['price', 'listPrice'] });
  const file = useVehicleFile(type === 'PURCHASE' ? null : vehicleId);
  const { purchase } = useCyclePurchase(
    type === 'SALE' ? vehicleId : null,
    file.openCycle?.id ?? file.vehicle?.openCycle?.id,
  );
  const forcedFull = type === 'SALE' && Boolean(purchase?.sellerIsVatBusiness);
  useEffect(() => {
    if (forcedFull) form.setValue('vatMode', 'FULL');
  }, [forcedFull, form]);

  const guard = useUnsavedChangesGuard(form.formState.isDirty);
  const submit = form.handleSubmit(async (body) => {
    clearFormError();
    try {
      await guard.submit(() => mutation.mutateAsync(body));
    } catch (error) {
      handleError(error);
    }
  });

  return (
    <FormLayout
      onSubmit={submit}
      aria-label={t(`deals.newOfType.${type}`)}
      className="rm-deal-form"
    >
      <Flex vertical gap={16} data-deal-type={type}>
        {formError && <Alert type="error" showIcon title={formError} />}

        <Card
          title={t('deals.form.sections.vehicle')}
          variant="borderless"
          data-testid="deal-section-vehicle"
        >
          {type === 'PURCHASE' && (
            <VehicleChoiceFields control={control} prefix="vehicle" testId="purchase-vehicle" />
          )}
          {type === 'SALE' && (
            <>
              <FormVehicleField
                control={control}
                name="vehicleId"
                label={t('deals.fields.vehicle')}
                required
                help={t('deals.form.salePickerHelp')}
                filters={SALE_FILTERS}
                isDisabled={noOpenCycle}
                data-testid="sale-vehicle-picker"
              />
              {file.vehicle && (
                <SaleVehicleInfo
                  vehicle={file.vehicle}
                  cycle={file.openCycle}
                  purchase={purchase}
                />
              )}
            </>
          )}
          {type === 'CONSIGNMENT_SALE' && (
            <>
              <FormVehicleField
                control={control}
                name="vehicleId"
                label={t('deals.fields.vehicle')}
                required
                help={t('deals.form.consignmentPickerHelp')}
                filters={CONSIGNMENT_FILTERS}
                isDisabled={noOpenCycle}
                data-testid="consignment-vehicle-picker"
              />
              {file.vehicle && <ConsignmentInfo cycle={file.openCycle} />}
            </>
          )}
        </Card>

        <Card
          title={t('deals.form.sections.terms')}
          variant="borderless"
          data-testid="deal-section-terms"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormContactField
                control={control}
                name="counterpartyId"
                label={t(counterpartyLabelKey(type))}
                required
                tag={type === 'PURCHASE' ? 'SELLER' : 'BUYER'}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormDateField
                control={control}
                name="date"
                label={t('deals.fields.date')}
                required
                allowClear={false}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormMoneyField
                control={control}
                name="price"
                label={t('deals.fields.price')}
                required
                min={0}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <FormMoneyField
                control={control}
                name="listPrice"
                label={t('deals.fields.listPrice')}
                min={0}
                help={listGapHelp(price, listPrice) ?? t('deals.form.listPriceHelp')}
              />
            </Col>
            {type === 'PURCHASE' && (
              <Col xs={24} md={18} className="rm-checkbox-col">
                <FormCheckboxField
                  control={control}
                  name="sellerIsVatBusiness"
                  label={t('deals.fields.sellerIsVatBusiness')}
                  help={t('deals.form.sellerVatHint')}
                />
              </Col>
            )}
          </Row>
        </Card>

        {type === 'SALE' && (
          <VatSection
            control={control}
            purchasePrice={purchase?.price ?? null}
            forcedFull={forcedFull}
          />
        )}
        {type === 'SALE' && <TradeInSection control={control} />}
        {type === 'CONSIGNMENT_SALE' && <CommissionSection cycle={file.openCycle} price={price} />}

        <Card
          title={t(
            type === 'PURCHASE' ? 'deals.form.sections.notes' : 'deals.form.sections.warranty',
          )}
          variant="borderless"
          data-testid="deal-section-notes"
        >
          <Row gutter={16}>
            {type !== 'PURCHASE' && (
              <Col xs={24} md={12}>
                <FormTextAreaField
                  control={control}
                  name="warrantyText"
                  label={t('deals.fields.warrantyText')}
                  help={t('deals.form.warrantyHelp')}
                  minRows={3}
                  maxLength={5000}
                />
              </Col>
            )}
            <Col xs={24} md={type === 'PURCHASE' ? 24 : 12}>
              <FormTextAreaField
                control={control}
                name="notes"
                label={t('common.notes')}
                minRows={3}
                maxLength={5000}
              />
            </Col>
          </Row>
        </Card>

        <Flex gap={8} justify="flex-end" wrap className="rm-form-actions">
          <Button onClick={() => guard.confirmDiscard(onCancel)} disabled={mutation.isPending}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            data-testid="deal-save"
          >
            {t('deals.form.submit')}
          </Button>
        </Flex>
      </Flex>
      {guard.prompt}
    </FormLayout>
  );
}

/** The gap text as a field help (or null when there is nothing to compare). */
function listGapHelp(price: number | null, listPrice: number | null) {
  if (!price || !listPrice) return null;
  return <ListGapText price={price} listPrice={listPrice} />;
}

/** Purchase price, days in stock and listing price of the car being sold. */
function SaleVehicleInfo({
  vehicle,
  cycle,
  purchase,
}: {
  vehicle: VehicleDetail;
  cycle: InventoryCycle | null;
  purchase: DealListItem | null;
}) {
  const { t, i18n } = useTranslation();
  const startedAt = cycle?.startedAt ?? vehicle.openCycle?.startedAt ?? null;
  const days = daysInStock(startedAt, todayInBusinessTz());
  return (
    <Descriptions
      size="small"
      column={DESCRIPTION_COLUMNS}
      data-testid="sale-vehicle-info"
      items={[
        {
          key: 'purchase',
          label: t('deals.fields.purchasePrice'),
          children: purchase ? (
            <Money amount={purchase.price} />
          ) : (
            <Typography.Text type="secondary">{t('deals.form.purchaseUnknown')}</Typography.Text>
          ),
        },
        {
          key: 'since',
          label: t('deals.fields.inStockSince'),
          children: <DateText value={startedAt} />,
        },
        {
          key: 'days',
          label: t('deals.fields.daysInStock'),
          children:
            days === null ? (
              <span className="rm-empty-value">—</span>
            ) : (
              <span data-testid="days-in-stock">
                {isolateLtr(formatCount(days, i18n.resolvedLanguage))}
              </span>
            ),
        },
        {
          key: 'listing',
          label: t('vehicles.fields.listingPrice'),
          children: <Money amount={vehicle.listingPrice} />,
        },
      ]}
    />
  );
}

/** Consignor, asking price, minimum net and commission rule of the consignment car. */
function ConsignmentInfo({ cycle }: { cycle: InventoryCycle | null }) {
  const { t } = useTranslation();
  if (!cycle || cycle.kind !== 'CONSIGNED') {
    return <Alert type="warning" showIcon title={t('deals.form.noConsignmentTerms')} />;
  }
  return (
    <Descriptions
      size="small"
      column={DESCRIPTION_COLUMNS}
      data-testid="consignment-info"
      items={[
        {
          key: 'consignor',
          label: t('deals.fields.consignor'),
          children: <ContactLink id={cycle.consignorId} name={cycle.consignor?.name} />,
        },
        {
          key: 'asking',
          label: t('deals.fields.askingPrice'),
          children: <Money amount={cycle.askingPrice} />,
        },
        {
          key: 'minNet',
          label: t('deals.fields.minNet'),
          children: <Money amount={cycle.minNetToConsignor} />,
        },
        {
          key: 'rule',
          label: t('deals.fields.commissionRule'),
          children: (
            <CommissionRuleText
              mode={cycle.commissionMode}
              value={cycle.commissionValue}
              minNet={cycle.minNetToConsignor}
            />
          ),
        },
      ]}
    />
  );
}

/** VAT mode of a sale (margin by default, full when forced) and the VAT it carries. */
function VatSection({
  control,
  purchasePrice,
  forcedFull,
}: {
  control: FormControl;
  purchasePrice: number | null;
  forcedFull: boolean;
}) {
  const { t, i18n } = useTranslation();
  const rate = useVatRate();
  const [mode, price] = useWatch({ control, name: ['vatMode', 'price'] });
  const vat = computeSaleVat(mode, price, purchasePrice, rate);
  const rateText = isolateLtr(
    `${formatCount(rate, i18n.resolvedLanguage, { maximumFractionDigits: 2 })}%`,
  );
  return (
    <Card title={t('deals.form.sections.vat')} variant="borderless" data-testid="deal-section-vat">
      <FormRadioField
        control={control}
        name="vatMode"
        label={t('deals.fields.vatMode')}
        optionType="button"
        options={[
          { value: 'MARGIN', label: t('enums.VatMode.MARGIN'), disabled: forcedFull },
          { value: 'FULL', label: t('enums.VatMode.FULL') },
        ]}
      />
      {forcedFull && (
        <Alert
          type="info"
          showIcon
          className="rm-dialog-note"
          title={t('deals.form.vatForcedFull')}
          data-testid="vat-forced-full"
        />
      )}
      <div data-testid="vat-preview" data-vat-mode={mode}>
        {vat ? (
          <Descriptions
            size="small"
            column={DESCRIPTION_COLUMNS}
            items={[
              {
                key: 'base',
                label:
                  mode === 'MARGIN' ? t('deals.form.vatMarginBase') : t('deals.form.vatFullBase'),
                children: <Money amount={vat.base} />,
              },
              { key: 'rate', label: t('deals.fields.vatRate'), children: rateText },
              {
                key: 'amount',
                label: t('deals.fields.vatAmount'),
                children: (
                  <span data-testid="vat-amount">
                    <Money amount={vat.amount} />
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">
            {mode === 'MARGIN' && price
              ? t('deals.form.vatNoPurchase')
              : t('deals.form.vatEnterPrice')}
          </Typography.Text>
        )}
      </div>
    </Card>
  );
}

/** Trade-in switch, the trade-in car and value, and the cash still due from the buyer. */
function TradeInSection({ control }: { control: FormControl }) {
  const { t } = useTranslation();
  const { field: enabledField } = useController({ control, name: 'tradeIn.enabled' });
  const enabled = Boolean(enabledField.value);
  const [price, value, listPrice] = useWatch({
    control,
    name: ['price', 'tradeIn.value', 'tradeIn.listPrice'],
  });
  const due = cashDue(price, value);
  return (
    <Card
      title={t('deals.form.sections.tradeIn')}
      variant="borderless"
      data-testid="deal-section-trade-in"
      extra={
        <Flex gap={8} align="center">
          <Switch
            checked={enabled}
            onChange={(on) => enabledField.onChange(on)}
            aria-label={t('deals.form.tradeInSwitch')}
            data-testid="trade-in-switch"
          />
          <Typography.Text>{t('deals.form.tradeInSwitch')}</Typography.Text>
        </Flex>
      }
    >
      {enabled ? (
        <Flex vertical gap={8} data-testid="trade-in-block">
          <VehicleChoiceFields
            control={control}
            prefix="tradeIn.vehicle"
            testId="trade-in-vehicle"
          />
          <Row gutter={16}>
            <Col xs={24} sm={12} lg={8}>
              <FormMoneyField
                control={control}
                name="tradeIn.value"
                label={t('deals.fields.tradeInValue')}
                required
                min={0}
                help={t('deals.form.tradeInHelp')}
              />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <FormMoneyField
                control={control}
                name="tradeIn.listPrice"
                label={t('deals.form.tradeInListPrice')}
                min={0}
                help={listGapHelp(value, listPrice) ?? undefined}
              />
            </Col>
          </Row>
          <Alert
            type="success"
            showIcon={false}
            data-testid="cash-due"
            title={
              <Flex gap={8} wrap align="baseline" justify="space-between">
                <span>
                  <Typography.Text strong>{t('deals.form.cashDue')}</Typography.Text>{' '}
                  <Typography.Text type="secondary">{t('deals.form.cashDueHint')}</Typography.Text>
                </span>
                <Typography.Text strong data-testid="cash-due-amount">
                  <Money amount={due} />
                </Typography.Text>
              </Flex>
            }
          />
        </Flex>
      ) : (
        <Typography.Text type="secondary">{t('deals.form.noTradeIn')}</Typography.Text>
      )}
    </Card>
  );
}

/** Commission and payout of a consignment sale at the typed price (shared commission rule). */
function CommissionSection({
  cycle,
  price,
}: {
  cycle: InventoryCycle | null;
  price: number | null;
}) {
  const { t } = useTranslation();
  const result = commissionPreview(cycle, price);
  return (
    <Card
      title={t('deals.form.sections.commission')}
      variant="borderless"
      data-testid="deal-section-commission"
    >
      {result ? (
        <Flex vertical gap={8} data-testid="commission-preview">
          <Descriptions
            size="small"
            column={DESCRIPTION_COLUMNS}
            items={[
              {
                key: 'rule',
                label: t('deals.fields.commissionRule'),
                children: (
                  <CommissionRuleText
                    mode={cycle?.commissionMode}
                    value={cycle?.commissionValue}
                    minNet={cycle?.minNetToConsignor}
                  />
                ),
              },
              {
                key: 'commission',
                label: t('deals.fields.commission'),
                children: (
                  <span data-testid="commission-amount">
                    <Money amount={result.commission} />
                  </span>
                ),
              },
              {
                key: 'payout',
                label: t('deals.fields.payout'),
                children: (
                  <span data-testid="payout-amount">
                    <Money amount={result.payout} />
                  </span>
                ),
              },
            ]}
          />
          {result.belowMinNet && (
            <Alert
              type="warning"
              showIcon
              data-testid="below-min-net"
              title={t('deals.form.belowMinNet')}
            />
          )}
        </Flex>
      ) : (
        <Typography.Text type="secondary">
          {cycle?.commissionMode
            ? t('deals.form.commissionEnterPrice')
            : t('deals.form.noConsignmentTerms')}
        </Typography.Text>
      )}
    </Card>
  );
}
