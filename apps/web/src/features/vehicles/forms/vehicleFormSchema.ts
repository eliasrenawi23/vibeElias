import { VehicleCreateSchema } from '@renawi/shared';
import type { DefaultValues } from 'react-hook-form';
import type { z } from 'zod';
import { displayPlate } from '../../../shared/lib/plate';
import type { VehicleDetail } from '../types';

/**
 * The vehicle form validates with `VehicleCreateSchema` in both modes. In edit mode the status
 * field is hidden (changes go through `POST /vehicles/:id/status`) and stripped before the PATCH.
 */
export const VehicleFormSchema = VehicleCreateSchema;
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
