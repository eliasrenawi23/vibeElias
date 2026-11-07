import { PlusOutlined } from '@ant-design/icons';
import { DepositKind, LeaseType } from '@renawi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Card, Col, Descriptions, Flex, Form, Radio, Row, Tag, Typography } from 'antd';
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useController, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { AutoDir, isolateLtr } from '../../../shared/lib/bidi';
import { useEnumLabel, useEnumOptions } from '../../../shared/lib/enums';
import { BalanceText } from '../../../shared/ui/BalanceText';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ExpiryBadge } from '../../../shared/ui/ExpiryBadge';
import { FieldShell } from '../../../shared/ui/FieldShell';
import { FormCheckboxField } from '../../../shared/ui/FormCheckboxField';
import { FormDateField } from '../../../shared/ui/FormDateField';
import { FormMoneyField } from '../../../shared/ui/FormMoneyField';
import { FormNumberField } from '../../../shared/ui/FormNumberField';
import { FormRadioField } from '../../../shared/ui/FormRadioField';
import { FormTextAreaField } from '../../../shared/ui/FormTextAreaField';
import { KmText } from '../../../shared/ui/KmText';
import { LicenseTag } from '../../../shared/ui/LicenseTag';
import { Money } from '../../../shared/ui/Money';
import { PlateNo } from '../../../shared/ui/PlateNo';
import { SelectableList, type SelectableItem } from '../../../shared/ui/SelectableList';
import { YearText } from '../../../shared/ui/YearText';
import { DriverPicker } from '../../drivers/components/DriverPicker';
import type { DriverListItem } from '../../drivers/types';
import { fetchTaxiLicense, fetchTaxiLicenses } from '../../taxi-licenses/api';
import { availableLicenses, lastRent } from '../../taxi-licenses/lib/licenseRules';
import { taxiLicenseKeys } from '../../taxi-licenses/queryKeys';
import type { TaxiLicenseListItem } from '../../taxi-licenses/types';
import { fetchVehicles } from '../../vehicles/api';
import { AlertBadges } from '../../vehicles/components/AlertBadges';
import { vehicleKeys } from '../../vehicles/queryKeys';
import type { VehicleListItem } from '../../vehicles/types';
import { ChecklistFields } from '../components/ChecklistFields';
import { ResponsibilitiesField } from '../components/ResponsibilitiesField';
import { defaultEndDate } from '../lib/leaseRules';
import type { LeaseWizardInput, LeaseWizardOutput } from './leaseWizardSchema';

export type WizardForm = UseFormReturn<LeaseWizardInput, unknown, LeaseWizardOutput>;

/** What the user picked, for labels on later steps and the review. */
export interface WizardPicks {
  driver?: DriverListItem | null;
  license?: TaxiLicenseListItem | null;
  vehicle?: VehicleListItem | null;
  /** Rent of the licence's last assignment (prefill). */
  lastRent?: number | null;
}

export interface StepProps {
  form: WizardForm;
  picks: WizardPicks;
  onPick: (picks: Partial<WizardPicks>) => void;
}

/** Value standing for "no car" in the number-only car list. */
const NO_CAR = '__none__';

/** Licence-age / expiry alerts worth showing when choosing a taxi. */
const CAR_ALERTS = [
  'taxiAge10',
  'taxiAgeNearLimit',
  'taxiAgeBlocked',
  'registrationExpired',
  'registrationExpiring',
];

/* ---- 1. Driver ----------------------------------------------------------------------------- */

export function DriverStep({ form, picks, onPick }: StepProps) {
  const { t } = useTranslation();
  const id = useId();
  const { field, fieldState } = useController({ control: form.control, name: 'driverId' });
  const driver = picks.driver;
  return (
    <Flex vertical gap={12}>
      <FieldShell id={id} label={t('leases.fields.driver')} required error={fieldState.error}>
        <DriverPicker
          id={id}
          value={field.value || null}
          onChange={(value, d) => {
            field.onChange(value ?? '');
            form.clearErrors('driverId');
            onPick({ driver: d, vehicle: null });
            form.setValue('vehicleId', null);
          }}
          onBlur={field.onBlur}
          status={fieldState.error ? 'error' : undefined}
          aria-label={t('leases.fields.driver')}
        />
      </FieldShell>
      <Link to="/drivers/new" className="rm-inline-create">
        <PlusOutlined /> {t('leases.wizard.newDriver')}
      </Link>
      {driver && (
        <Card size="small" variant="outlined" data-testid="wizard-driver-summary">
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 3 }}
            items={[
              {
                key: 'name',
                label: t('leases.fields.driver'),
                children: <AutoDir>{driver.name}</AutoDir>,
              },
              {
                key: 'balance',
                label: t('ledger.fields.balance'),
                children: <BalanceText amount={driver.balance?.balance ?? 0} />,
              },
              {
                key: 'permit',
                label: t('drivers.fields.taxiPermitExpiry'),
                children: <ExpiryBadge value={driver.taxiPermitExpiry} showValid />,
              },
            ]}
          />
          {driver.activeContract && (
            <Alert
              type="warning"
              showIcon
              title={t('leases.wizard.driverHasLease', {
                no: isolateLtr(`#${driver.activeContract.contractNo}`),
              })}
            />
          )}
        </Card>
      )}
    </Flex>
  );
}

/* ---- 2. Licence ---------------------------------------------------------------------------- */

export function LicenseStep({ form, onPick }: StepProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const id = useId();
  const { field, fieldState } = useController({ control: form.control, name: 'taxiLicenseId' });
  const licenses = useQuery({
    queryKey: taxiLicenseKeys.available(),
    queryFn: ({ signal }) => fetchTaxiLicenses({ status: 'ACTIVE', pageSize: 200 }, signal),
  });
  const available = useMemo(() => availableLicenses(licenses.data?.items ?? []), [licenses.data]);

  const pick = async (licenseId: string) => {
    const license = available.find((l) => l.id === licenseId) ?? null;
    field.onChange(licenseId);
    form.clearErrors('taxiLicenseId');
    onPick({ license, lastRent: null });
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: taxiLicenseKeys.detail(licenseId),
        queryFn: ({ signal }) => fetchTaxiLicense(licenseId, signal),
      });
      const rent = lastRent(detail.segments);
      onPick({ lastRent: rent });
      if (rent && !form.getValues('monthlyRent')) form.setValue('monthlyRent', rent);
    } catch {
      // The prefill is a convenience only.
    }
  };

  const items: SelectableItem[] = available.map((l) => ({
    value: l.id,
    title: (
      <Flex gap={8} align="center" wrap>
        <LicenseTag licenseNo={l.licenseNo} />
        {l.holderName && <AutoDir>{l.holderName}</AutoDir>}
      </Flex>
    ),
    description: l.registeredVehicle ? (
      <span>
        {t('taxiLicenses.fields.registeredVehicle')}:{' '}
        <PlateNo value={l.registeredVehicle.plateNo} variant="text" />
      </span>
    ) : (
      t('taxiLicenses.noRegisteredVehicle')
    ),
    extra: l.alerts?.includes('idle') ? (
      <Tag color="green">{t('taxiLicenses.alerts.idle')}</Tag>
    ) : undefined,
  }));

  return (
    <FieldShell id={id} label={t('leases.wizard.chooseLicense')} required error={fieldState.error}>
      {licenses.isPending ? (
        <Card loading variant="borderless" />
      ) : (
        <SelectableList
          label={t('leases.wizard.chooseLicense')}
          items={items}
          value={field.value || null}
          onChange={(v) => void pick(v)}
          invalid={Boolean(fieldState.error)}
          data-testid="wizard-licenses"
          empty={<EmptyState compact description={t('leases.wizard.noLicenses')} />}
        />
      )}
    </FieldShell>
  );
}

/* ---- 3. Car -------------------------------------------------------------------------------- */

function carItem(v: VehicleListItem, extraTag: ReactNode, kmLabel: string): SelectableItem {
  return {
    value: v.id,
    title: (
      <Flex gap={8} align="center" wrap>
        <PlateNo value={v.plateNo} />
        <span>
          <AutoDir>{`${v.make} ${v.model}`}</AutoDir> <YearText value={v.year} />
        </span>
      </Flex>
    ),
    description: (
      <Flex gap={12} wrap component="span">
        <span>
          {kmLabel}: <KmText value={v.currentKm} />
        </span>
        {v.registrationExpiry && <DateText value={v.registrationExpiry} />}
      </Flex>
    ),
    extra: (
      <>
        {extraTag}
        <AlertBadges alerts={v.alerts?.filter((a) => CAR_ALERTS.includes(a))} hideEmpty />
      </>
    ),
    disabled: v.alerts?.includes('taxiAgeBlocked') ?? false,
  };
}

export function VehicleStep({ form, picks, onPick }: StepProps) {
  const { t } = useTranslation();
  const id = useId();
  const typeOptions = useEnumOptions('LeaseType', LeaseType.options);
  const type = useWatch({ control: form.control, name: 'type' });
  const driverId = useWatch({ control: form.control, name: 'driverId' });
  const { field, fieldState } = useController({ control: form.control, name: 'vehicleId' });
  const { field: typeField } = useController({ control: form.control, name: 'type' });

  const taxis = useQuery({
    queryKey: vehicleKeys.list({
      isTaxi: true,
      status: 'IN_STOCK',
      ownership: 'OWNED',
      pageSize: 100,
    }),
    queryFn: ({ signal }) =>
      fetchVehicles(
        { isTaxi: true, status: 'IN_STOCK', ownership: 'OWNED', pageSize: 100 },
        signal,
      ),
    enabled: type === 'CAR_AND_NUMBER',
  });
  const ownCars = useQuery({
    queryKey: vehicleKeys.list({ ownership: 'THIRD_PARTY', pageSize: 200 }),
    queryFn: ({ signal }) => fetchVehicles({ ownership: 'THIRD_PARTY', pageSize: 200 }, signal),
    enabled: type === 'NUMBER_ONLY',
  });

  const registeredId = picks.license?.registeredVehicle?.id;
  const list =
    type === 'CAR_AND_NUMBER'
      ? (taxis.data?.items ?? [])
      : (ownCars.data?.items ?? []).filter((v) => v.ownerDriver?.id === driverId);
  const items: SelectableItem[] = list.map((v) =>
    carItem(
      v,
      v.id === registeredId ? (
        <Tag color="green">{t('leases.wizard.registeredOnLicense')}</Tag>
      ) : null,
      t('vehicles.fields.currentKm'),
    ),
  );
  if (type === 'NUMBER_ONLY') {
    items.unshift({
      value: NO_CAR,
      title: t('leases.wizard.noCar'),
      description: t('leases.wizard.noCarHint'),
    });
  }
  const loading = type === 'CAR_AND_NUMBER' ? taxis.isPending : ownCars.isPending;

  const choose = (value: string) => {
    const vehicleId = value === NO_CAR ? null : value;
    field.onChange(vehicleId);
    form.clearErrors('vehicleId');
    onPick({ vehicle: list.find((v) => v.id === vehicleId) ?? null });
  };

  return (
    <Flex vertical gap={12}>
      <Form.Item
        label={<span id={`${id}-type`}>{t('leases.fields.type')}</span>}
        required
        help={
          type === 'CAR_AND_NUMBER'
            ? t('leases.wizard.carAndNumberHint')
            : t('leases.wizard.numberOnlyHint')
        }
      >
        <Radio.Group
          value={typeField.value}
          optionType="button"
          buttonStyle="solid"
          options={typeOptions}
          aria-labelledby={`${id}-type`}
          onChange={(e) => {
            typeField.onChange(e.target.value);
            field.onChange(null);
            form.clearErrors('vehicleId');
            onPick({ vehicle: null });
          }}
          data-testid="field-type"
        />
      </Form.Item>
      <FieldShell
        id={id}
        label={
          type === 'CAR_AND_NUMBER' ? t('leases.wizard.chooseCar') : t('leases.wizard.chooseOwnCar')
        }
        required={type === 'CAR_AND_NUMBER'}
        error={fieldState.error}
      >
        {loading ? (
          <Card loading variant="borderless" />
        ) : (
          <SelectableList
            label={
              type === 'CAR_AND_NUMBER'
                ? t('leases.wizard.chooseCar')
                : t('leases.wizard.chooseOwnCar')
            }
            items={items}
            value={field.value ?? (type === 'NUMBER_ONLY' ? NO_CAR : null)}
            onChange={choose}
            invalid={Boolean(fieldState.error)}
            data-testid="wizard-vehicles"
            empty={<EmptyState compact description={t('leases.wizard.noCars')} />}
          />
        )}
      </FieldShell>
      {type === 'NUMBER_ONLY' && (
        <Typography.Text type="secondary">{t('leases.wizard.ownCarHint')}</Typography.Text>
      )}
    </Flex>
  );
}

/* ---- 4. Terms ------------------------------------------------------------------------------ */

export function TermsStep({ form, picks }: StepProps) {
  const { t } = useTranslation();
  const start = useWatch({ control: form.control, name: 'startDate' });
  // Moving the start moves the end too, while the end is still the one-year default.
  const prevStart = useRef(start);
  useEffect(() => {
    const prev = prevStart.current;
    prevStart.current = start;
    if (prev && start && prev !== start && form.getValues('endDate') === defaultEndDate(prev)) {
      form.setValue('endDate', defaultEndDate(start), { shouldValidate: true });
    }
  }, [start, form]);
  return (
    <Row gutter={16}>
      <Col xs={24} md={8}>
        <FormDateField
          control={form.control}
          name="startDate"
          label={t('leases.fields.startDate')}
          required
          allowClear={false}
        />
      </Col>
      <Col xs={24} md={8}>
        <FormDateField
          control={form.control}
          name="endDate"
          label={t('leases.fields.endDate')}
          required
          allowClear={false}
          help={start ? t('leases.form.endDateHelp') : undefined}
        />
      </Col>
      <Col xs={24} md={8}>
        <FormMoneyField
          control={form.control}
          name="monthlyRent"
          label={t('leases.fields.monthlyRent')}
          required
          min={0}
          help={
            picks.lastRent ? (
              <span>
                {t('leases.form.lastRent')}: <Money amount={picks.lastRent} />
              </span>
            ) : undefined
          }
        />
      </Col>
      <Col xs={24} md={8}>
        <FormNumberField
          control={form.control}
          name="paymentDay"
          label={t('leases.fields.paymentDay')}
          required
          min={1}
          max={28}
          help={t('leases.form.paymentDayHelp')}
        />
      </Col>
      <Col xs={24} md={8}>
        <FormNumberField
          control={form.control}
          name="earlyExitPenaltyMonths"
          label={t('leases.fields.earlyExitPenaltyMonths')}
          min={0}
          max={12}
          precision={2}
          unit={t('units.months')}
          grouping={false}
          help={t('leases.form.penaltyHelp')}
        />
      </Col>
      <Col xs={24} md={8} className="rm-checkbox-col">
        <FormCheckboxField
          control={form.control}
          name="rentIncludesVat"
          label={t('leases.fields.rentIncludesVat')}
        />
      </Col>
      <Col xs={24} md={12}>
        <ResponsibilitiesField control={form.control} name="responsibilities" />
      </Col>
      <Col xs={24} md={12}>
        <FormTextAreaField
          control={form.control}
          name="terms"
          label={t('leases.fields.terms')}
          help={t('leases.form.termsHelp')}
          minRows={4}
          maxLength={20000}
        />
      </Col>
    </Row>
  );
}

/* ---- 5. Deposit & handover ----------------------------------------------------------------- */

export function DepositStep({ form }: StepProps) {
  const { t } = useTranslation();
  const kindOptions = useEnumOptions('DepositKind', DepositKind.options);
  const type = useWatch({ control: form.control, name: 'type' });
  return (
    <Flex vertical gap={16}>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <FormMoneyField
            control={form.control}
            name="depositAmount"
            label={t('leases.fields.depositAmount')}
            min={0}
            help={t('leases.form.depositHelp')}
          />
        </Col>
        <Col xs={24} md={16}>
          <FormRadioField
            control={form.control}
            name="depositKind"
            label={t('leases.fields.depositKind')}
            options={kindOptions}
            optionType="button"
          />
        </Col>
      </Row>
      {type === 'CAR_AND_NUMBER' ? (
        <Card size="small" variant="outlined" title={t('checklist.handoverTitle')}>
          <ChecklistFields control={form.control} prefix="handoverChecklist" kind="handover" />
        </Card>
      ) : (
        <Alert type="info" showIcon title={t('leases.wizard.noHandover')} />
      )}
    </Flex>
  );
}

/* ---- 6. Review ----------------------------------------------------------------------------- */

export function ReviewStep({ form, picks }: StepProps) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const v = useWatch({ control: form.control }) as LeaseWizardInput;
  const empty = <span className="rm-empty-value">—</span>;
  const resp = v.responsibilities;
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, md: 2 }}
      data-testid="wizard-review"
      items={[
        {
          key: 'driver',
          label: t('leases.fields.driver'),
          children: picks.driver ? <AutoDir>{picks.driver.name}</AutoDir> : empty,
        },
        {
          key: 'type',
          label: t('leases.fields.type'),
          children: v.type ? enumLabel('LeaseType', v.type) : empty,
        },
        {
          key: 'license',
          label: t('leases.fields.license'),
          children: <LicenseTag licenseNo={picks.license?.licenseNo} />,
        },
        {
          key: 'vehicle',
          label: t('leases.fields.vehicle'),
          children: picks.vehicle ? <PlateNo value={picks.vehicle.plateNo} /> : empty,
        },
        {
          key: 'period',
          label: t('leases.fields.period'),
          children: (
            <span>
              <DateText value={v.startDate} /> – <DateText value={v.endDate} />
            </span>
          ),
        },
        {
          key: 'rent',
          label: t('leases.fields.monthlyRent'),
          children: <Money amount={v.monthlyRent} />,
        },
        {
          key: 'paymentDay',
          label: t('leases.fields.paymentDay'),
          children: <span className="rm-tabular">{v.paymentDay}</span>,
        },
        {
          key: 'vat',
          label: t('leases.fields.rentIncludesVat'),
          children: v.rentIncludesVat ? t('actions.yes') : t('actions.no'),
        },
        {
          key: 'penalty',
          label: t('leases.fields.earlyExitPenaltyMonths'),
          children: (
            <span>
              <span className="rm-tabular">{v.earlyExitPenaltyMonths}</span> {t('units.months')}
            </span>
          ),
        },
        {
          key: 'deposit',
          label: t('leases.fields.depositAmount'),
          children: (
            <span>
              <Money amount={v.depositAmount ?? 0} /> ·{' '}
              {v.depositKind ? enumLabel('DepositKind', v.depositKind) : ''}
            </span>
          ),
        },
        {
          key: 'resp',
          label: t('leases.fields.responsibilities'),
          span: 'filled' as const,
          children: resp ? (
            <Flex gap={8} wrap>
              {(['insurance', 'test', 'repairs', 'fines'] as const).map((k) => (
                <Tag key={k}>
                  {t(`responsibility.${k}`)}: {enumLabel('ResponsibleParty', resp[k] ?? 'DRIVER')}
                </Tag>
              ))}
            </Flex>
          ) : (
            empty
          ),
        },
        ...(v.type === 'CAR_AND_NUMBER'
          ? [
              {
                key: 'handover',
                label: t('checklist.handoverTitle'),
                span: 'filled' as const,
                children: (
                  <Flex gap={12} wrap>
                    <span>
                      {t('checklist.condition.km')}:{' '}
                      <KmText value={v.handoverChecklist?.km ?? null} />
                    </span>
                    <span>
                      {t('checklist.condition.fuelLevel')}:{' '}
                      {v.handoverChecklist?.fuelLevel
                        ? enumLabel('FuelLevel', v.handoverChecklist.fuelLevel)
                        : '—'}
                    </span>
                  </Flex>
                ),
              },
            ]
          : []),
      ]}
    />
  );
}
