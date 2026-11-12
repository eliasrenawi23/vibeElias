import { z } from 'zod';
import { annualFeeDueDate } from '../dates.js';
import { TaxiLicenseStatus } from '../enums.js';
import { msg } from '../messages.js';
import {
  idString,
  isoDate,
  nonNegativeMoney,
  optionalIsoDate,
  optionalText,
  pagination,
  positiveMoney,
  queryBool,
  queryList,
  querySearch,
} from '../primitives.js';

/** Taxi licence ("green number") identifier: digits/letters with optional dashes, 1-20 chars. */
export const licenseNo = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[0-9A-Za-z-]+$/, { message: msg.invalidValue });

const TaxiLicenseBaseSchema = z.object({
  licenseNo,
  holderName: optionalText(150),
  status: TaxiLicenseStatus.default('ACTIVE'),
  acquiredAt: optionalIsoDate,
  acquisitionPrice: nonNegativeMoney.nullish(),
  soldAt: optionalIsoDate,
  salePrice: nonNegativeMoney.nullish(),
  /** Annual operating-licence fee due (December slip). Defaults to 31 Dec of the current year. */
  annualFeeDueAt: optionalIsoDate,
  renewalAt: optionalIsoDate,
  notes: optionalText(5000),
});

function refineTaxiLicense(
  v: { status?: TaxiLicenseStatus; soldAt?: string | null },
  ctx: z.RefinementCtx,
  partial: boolean,
) {
  const missingSoldAt = partial ? v.soldAt === null : !v.soldAt;
  if (v.status === 'SOLD' && missingSoldAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['soldAt'], message: msg.soldAtRequired });
  }
}

/** `POST /taxi-licenses` (the registered car is set via `/register-vehicle`). */
export const TaxiLicenseCreateSchema = TaxiLicenseBaseSchema.superRefine((v, ctx) =>
  refineTaxiLicense(v, ctx, false),
);
export type TaxiLicenseCreate = z.infer<typeof TaxiLicenseCreateSchema>;
export type TaxiLicenseCreateInput = z.input<typeof TaxiLicenseCreateSchema>;

/** `PATCH /taxi-licenses/:id` */
export const TaxiLicenseUpdateSchema = TaxiLicenseBaseSchema.partial().superRefine((v, ctx) =>
  refineTaxiLicense(v, ctx, true),
);
export type TaxiLicenseUpdate = z.infer<typeof TaxiLicenseUpdateSchema>;
export type TaxiLicenseUpdateInput = z.input<typeof TaxiLicenseUpdateSchema>;

/** `GET /taxi-licenses` */
export const TaxiLicenseQuerySchema = pagination.extend({
  q: querySearch.optional(),
  status: queryList(TaxiLicenseStatus).optional(),
  /** true: no open lease segment (free to lease); false: currently leased. */
  available: queryBool.optional(),
});
export type TaxiLicenseQuery = z.infer<typeof TaxiLicenseQuerySchema>;

/**
 * `POST /taxi-licenses/:id/register-vehicle`: the car registered under this number at the MoT
 * (reg. 287b assignment form). `vehicleId: null` detaches. The server refuses vehicles aged
 * 12+ years (see `taxiAgeStatus`).
 */
export const TaxiLicenseRegisterVehicleSchema = z.object({
  vehicleId: idString.nullable(),
  /** Date of the assignment (meter resealed). Defaults to today. */
  date: isoDate.optional(),
  /** Meter seal date to store on the vehicle. */
  meterSealedAt: isoDate.optional(),
  notes: optionalText(1000),
});
export type TaxiLicenseRegisterVehicle = z.infer<typeof TaxiLicenseRegisterVehicleSchema>;

/**
 * `POST /taxi-licenses/:id/fee-paid`: the annual operating-licence fee was paid. `annualFeeDueAt`
 * moves to 31 December of the year after the current due date's year (no due date: the year
 * after `paidAt`). With an `amount` and a car registered on the licence, a LICENSE_FEE expense
 * paid by us is recorded on that car (dated `paidAt`, the note as its description).
 */
export const TaxiLicenseFeePaidSchema = z.object({
  /** Payment date; defaults to today. */
  paidAt: isoDate.optional(),
  amount: positiveMoney.nullish(),
  note: optionalText(500),
});
export type TaxiLicenseFeePaid = z.infer<typeof TaxiLicenseFeePaidSchema>;
export type TaxiLicenseFeePaidInput = z.input<typeof TaxiLicenseFeePaidSchema>;

/** Next annual-fee due date after paying the fee due on `currentDueAt` (31 Dec of Y + 1). */
export function nextAnnualFeeDueAt(currentDueAt: string | null, paidAt: string): string {
  const year = Number((currentDueAt ?? paidAt).slice(0, 4));
  return annualFeeDueDate(year + 1);
}
