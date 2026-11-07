import {
  msg,
  VehicleBaseSchema,
  type VehicleCreate,
  type VehicleOwnership,
  type VehicleUpdate,
} from '@renawi/shared';
import type { DefaultValues } from 'react-hook-form';
import { z } from 'zod';
import { displayPlate } from '../../../shared/lib/plate';
import type { VehicleDetail } from '../types';

/** Oldest manufacture year offered by the form (the API accepts older cars). */
export const FORM_MIN_YEAR = 1990;

/** Newest manufacture year: next year's models are sold from the autumn. */
export function formMaxYear(): number {
  return new Date().getFullYear() + 1;
}

/**
 * `VehicleCreateSchema` for the form, with the manufacture year limited to 1990..next year. In
 * edit mode the status field is hidden (changes go through `POST /vehicles/:id/status`) and
 * stripped before the PATCH.
 */
export const VehicleFormSchema = VehicleBaseSchema.extend({
  year: z
    .number({ required_error: msg.required, invalid_type_error: msg.required })
    .int()
    .min(FORM_MIN_YEAR)
    .max(formMaxYear()),
}).superRefine((v, ctx) => {
  if (v.ownership === 'THIRD_PARTY' && !v.ownerDriverId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ownerDriverId'],
      message: msg.ownerDriverRequired,
    });
  }
});
export type VehicleFormInput = z.input<typeof VehicleFormSchema>;
export type VehicleFormOutput = z.output<typeof VehicleFormSchema>;

/** API vehicle (or nothing, for a new one) to form values; nulls become '' for text inputs. */
export function toVehicleFormValues(v?: VehicleDetail | null): DefaultValues<VehicleFormInput> {
  return {
    plateNo: v ? displayPlate(v.plateNo) : '',
    vin: v?.vin ?? '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    trim: v?.trim ?? '',
    year: v?.year,
    color: v?.color ?? '',
    fuel: v?.fuel ?? null,
    gearbox: v?.gearbox ?? null,
    engineCc: v?.engineCc ?? null,
    hand: v?.hand ?? null,
    isTaxi: v?.isTaxi ?? false,
    status: v?.status ?? 'IN_STOCK',
    ownership: v?.ownership ?? 'OWNED',
    ownerDriverId: v?.ownerDriverId ?? null,
    currentKm: v?.currentKm ?? null,
    registrationExpiry: v?.registrationExpiry ?? null,
    dealerRegisteredAt: v?.dealerRegisteredAt ?? null,
    meterSerial: v?.meterSerial ?? '',
    meterSealedAt: v?.meterSealedAt ?? null,
    location: v?.location ?? '',
    listingPrice: v?.listingPrice ?? null,
    notes: v?.notes ?? '',
  };
}

/**
 * Parsed form values to the `POST /vehicles` body: the owner driver only for THIRD_PARTY cars,
 * meter details only for taxis.
 */
export function toVehicleCreateBody(values: VehicleFormOutput): VehicleCreate {
  return {
    ...values,
    ownerDriverId: values.ownership === 'THIRD_PARTY' ? (values.ownerDriverId ?? null) : null,
    meterSerial: values.isTaxi ? (values.meterSerial ?? null) : null,
    meterSealedAt: values.isTaxi ? (values.meterSealedAt ?? null) : null,
  };
}

/** `PATCH /vehicles/:id` body: as for create, without the status. */
export function toVehicleUpdateBody(values: VehicleCreate): VehicleUpdate {
  const { status: _status, ...rest } = values;
  return rest;
}

/**
 * Ownership values the form offers. A vehicle becomes CONSIGNED only through the consignment
 * action, so CONSIGNED is offered when creating a vehicle or when it already is one.
 */
export function ownershipChoices(
  all: readonly VehicleOwnership[],
  current: VehicleOwnership | undefined,
): VehicleOwnership[] {
  if (!current || current === 'CONSIGNED') return [...all];
  return all.filter((o) => o !== 'CONSIGNED');
}
