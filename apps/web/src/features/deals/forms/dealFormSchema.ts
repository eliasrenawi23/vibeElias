import { zodResolver } from '@hookform/resolvers/zod';
import {
  idString,
  isoDate,
  msg,
  nonNegativeMoney,
  optionalText,
  positiveMoney,
  VehicleBaseSchema,
  type DealType,
  type Fuel,
  type Gearbox,
} from '@renawi/shared';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { FORM_MIN_YEAR, formMaxYear } from '../../vehicles/forms/vehicleFormSchema';
import type { DealCreateBody, DealVehicleCreate } from '../types';

/** A car in the system (picked) or a new one typed inline. */
export const VEHICLE_MODES = ['existing', 'new'] as const;
export type VehicleMode = (typeof VEHICLE_MODES)[number];

/** Inline car fields as the inputs hold them ('' for empty text, null for empty numbers). */
export interface DealVehicleInput {
  plateNo: string;
  vin: string;
  make: string;
  model: string;
  trim: string;
  year: number | null;
  color: string;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  hand: number | null;
  isTaxi: boolean;
  currentKm: number | null;
  registrationExpiry: string | null;
}

/** `vehicle` of a purchase / trade-in: mirrors the body (`{ id }` or `{ create }`) plus the mode. */
export interface VehicleChoiceValues {
  mode: VehicleMode;
  id: string | null;
  create: DealVehicleInput;
}

/**
 * Values of the deal form (every type; the type-specific parts are ignored for other types).
 * Field paths mirror the `POST /deals` body, so API field errors such as
 * `vehicle.create.plateNo` or `tradeIn.vehicle.create.plateNo` land on their inputs as-is.
 */
export interface DealFormValues {
  type: DealType;
  /** PURCHASE: the car bought. */
  vehicle: VehicleChoiceValues;
  /** SALE / CONSIGNMENT_SALE: the car sold. */
  vehicleId: string | null;
  counterpartyId: string | null;
  date: string;
  price: number | null;
  listPrice: number | null;
  sellerIsVatBusiness: boolean;
  vatMode: 'MARGIN' | 'FULL';
  warrantyText: string;
  tradeIn: {
    enabled: boolean;
    vehicle: VehicleChoiceValues;
    value: number | null;
    listPrice: number | null;
  };
  notes: string;
}

/** Top-level form fields (API errors on other paths go to the form alert). */
export const DEAL_FORM_FIELDS = [
  'vehicle',
  'vehicleId',
  'counterpartyId',
  'date',
  'price',
  'listPrice',
  'sellerIsVatBusiness',
  'vatMode',
  'warrantyText',
  'tradeIn',
  'notes',
] as const;

/** Empty inline car. */
export function emptyDealVehicle(): DealVehicleInput {
  return {
    plateNo: '',
    vin: '',
    make: '',
    model: '',
    trim: '',
    year: null,
    color: '',
    fuel: null,
    gearbox: null,
    hand: null,
    isTaxi: false,
    currentKm: null,
    registrationExpiry: null,
  };
}

export interface DealFormDefaults {
  type: DealType;
  /** Preselected car (`?vehicleId=`). */
  vehicleId?: string | null;
  today: string;
  /** Default warranty text of a sale (Hebrew). */
  warrantyText: string;
}

/** Initial values of a new deal of `type`. */
export function defaultDealValues({
  type,
  vehicleId,
  today,
  warrantyText,
}: DealFormDefaults): DealFormValues {
  const preset = vehicleId ?? null;
  return {
    type,
    vehicle: {
      mode: type === 'PURCHASE' && preset ? 'existing' : 'new',
      id: type === 'PURCHASE' ? preset : null,
      create: emptyDealVehicle(),
    },
    vehicleId: type === 'PURCHASE' ? null : preset,
    counterpartyId: null,
    date: today,
    price: null,
    listPrice: null,
    sellerIsVatBusiness: false,
    vatMode: 'MARGIN',
    warrantyText: type === 'PURCHASE' ? '' : warrantyText,
    tradeIn: {
      enabled: false,
      vehicle: { mode: 'new', id: null, create: emptyDealVehicle() },
      value: null,
      listPrice: null,
    },
    notes: '',
  };
}

/* ---- Schemas ------------------------------------------------------------------------------- */

/** A required id with its own message (empty picker -> "choose the car / contact"). */
function requiredId(message: string) {
  return z.preprocess(
    (v) => (v === null || v === '' ? undefined : v),
    z.string({ required_error: message, invalid_type_error: message }).pipe(idString),
  );
}

/** Required amount > 0 (an empty input says "required", not "invalid amount"). */
const requiredMoney = z.preprocess((v) => (v === null ? undefined : v), positiveMoney);
/** Optional amount >= 0, sent as `null` when empty. */
const optionalMoney = nonNegativeMoney.nullish().transform((v) => v ?? null);
const optionalLongText = optionalText(5000).transform((v) => v ?? null);

/** Inline car: the vehicle schema's fields, with the form's manufacture-year range. */
export const DealVehicleFormSchema = VehicleBaseSchema.pick({
  plateNo: true,
  vin: true,
  make: true,
  model: true,
  trim: true,
  color: true,
  fuel: true,
  gearbox: true,
  hand: true,
  isTaxi: true,
  currentKm: true,
  registrationExpiry: true,
})
  .extend({
    year: z
      .number({ required_error: msg.required, invalid_type_error: msg.required })
      .int()
      .min(FORM_MIN_YEAR)
      .max(formMaxYear()),
  })
  .transform((v): DealVehicleCreate => ({
    plateNo: v.plateNo,
    vin: v.vin ?? null,
    make: v.make,
    model: v.model,
    trim: v.trim ?? null,
    year: v.year,
    color: v.color ?? null,
    fuel: v.fuel ?? null,
    gearbox: v.gearbox ?? null,
    hand: v.hand ?? null,
    isTaxi: v.isTaxi,
    currentKm: v.currentKm ?? null,
    registrationExpiry: v.registrationExpiry ?? null,
  }));

/** `{ id }` for a picked car, `{ create }` for a new one (the other keys are stripped). */
function vehicleChoiceSchema(mode: VehicleMode) {
  return mode === 'existing'
    ? z.object({ id: requiredId(msg.vehicleRequired) })
    : z.object({ create: DealVehicleFormSchema });
}

const commonFields = {
  counterpartyId: requiredId(msg.contactRequired),
  date: isoDate,
  price: requiredMoney,
  listPrice: optionalMoney,
  notes: optionalLongText,
};

/**
 * Schema for the current values: which parts are validated (and sent) depends on the deal type,
 * the purchase / trade-in car mode and the trade-in switch. Output = the `POST /deals` body.
 */
export function dealFormSchema(values: Pick<DealFormValues, 'type' | 'vehicle' | 'tradeIn'>) {
  if (values.type === 'PURCHASE') {
    return z.object({
      type: z.literal('PURCHASE'),
      vehicle: vehicleChoiceSchema(values.vehicle.mode),
      ...commonFields,
      sellerIsVatBusiness: z.boolean(),
    });
  }
  if (values.type === 'CONSIGNMENT_SALE') {
    return z.object({
      type: z.literal('CONSIGNMENT_SALE'),
      vehicleId: requiredId(msg.vehicleRequired),
      ...commonFields,
      warrantyText: optionalLongText,
    });
  }
  const tradeIn = values.tradeIn.enabled
    ? z.object({
        vehicle: vehicleChoiceSchema(values.tradeIn.vehicle.mode),
        value: requiredMoney,
        listPrice: optionalMoney,
      })
    : z.unknown().transform(() => undefined);
  return z
    .object({
      type: z.literal('SALE'),
      vehicleId: requiredId(msg.vehicleRequired),
      ...commonFields,
      vatMode: z.enum(['MARGIN', 'FULL']),
      warrantyText: optionalLongText,
      tradeIn,
    })
    .superRefine((v, ctx) => {
      if (v.tradeIn && v.tradeIn.value > v.price) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tradeIn', 'value'],
          message: 'deals.validation.tradeInOverPrice',
        });
      }
    });
}

/** react-hook-form resolver validating with `dealFormSchema(values)`; outputs the API body. */
export const dealFormResolver: Resolver<DealFormValues, unknown, DealCreateBody> = (
  values,
  context,
  options,
) => {
  const resolver = zodResolver(dealFormSchema(values) as z.ZodTypeAny) as unknown as Resolver<
    DealFormValues,
    unknown,
    DealCreateBody
  >;
  return resolver(values, context, options);
};
