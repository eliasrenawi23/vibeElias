import { z } from 'zod';
import {
  ChargeKind,
  CommissionMode,
  ExpenseCategory,
  Fuel,
  Gearbox,
  InsuranceScope,
  InsuranceType,
  PaidBy,
  VehicleOwnership,
  VehicleStatus,
} from '../enums.js';
import { msg } from '../messages.js';
import {
  idString,
  isoDate,
  nonNegativeMoney,
  optionalIsoDate,
  optionalText,
  pagination,
  plateNo,
  positiveMoney,
  queryBool,
  queryList,
  querySearch,
} from '../primitives.js';

/* ------------------------------------------------------------------------------------------ */
/* Vehicle                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** VIN / chassis number: 5-20 letters/digits (older Israeli cars have short chassis numbers). */
export const vin = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{5,20}$/, { message: msg.invalidVin }));

/** Optional VIN for forms ('' becomes null). */
export const optionalVin = z.union([z.literal('').transform(() => null), vin]).nullish();

const MIN_YEAR = 1950;
/** Manufacture year (drives the taxi 12-year rule). */
export const manufactureYear = z
  .number()
  .int()
  .min(MIN_YEAR)
  .max(new Date().getUTCFullYear() + 1);

export const VehicleBaseSchema = z.object({
  plateNo,
  vin: optionalVin,
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  trim: optionalText(60),
  year: manufactureYear,
  color: optionalText(40),
  fuel: Fuel.nullish(),
  gearbox: Gearbox.nullish(),
  engineCc: z.number().int().min(0).max(20_000).nullish(),
  /** Ownership hand (yad). */
  hand: z.number().int().min(0).max(30).nullish(),
  isTaxi: z.boolean().default(false),
  status: VehicleStatus.default('IN_STOCK'),
  ownership: VehicleOwnership.default('OWNED'),
  /** THIRD_PARTY only: the driver who owns the car (NUMBER_ONLY leases). */
  ownerDriverId: idString.nullish(),
  currentKm: z.number().int().min(0).max(3_000_000).nullish(),
  /** Vehicle licence / annual test expiry. */
  registrationExpiry: optionalIsoDate,
  /** Start of "dealer-owned" registration (12-month cap). */
  dealerRegisteredAt: optionalIsoDate,
  meterSerial: optionalText(50),
  meterSealedAt: optionalIsoDate,
  location: optionalText(100),
  listingPrice: nonNegativeMoney.nullish(),
  notes: optionalText(5000),
});

function refineVehicle(
  v: { ownership?: VehicleOwnership; ownerDriverId?: string | null },
  ctx: z.RefinementCtx,
) {
  if (v.ownership === 'THIRD_PARTY' && !v.ownerDriverId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ownerDriverId'],
      message: msg.ownerDriverRequired,
    });
  }
}

/** `POST /vehicles` */
export const VehicleCreateSchema = VehicleBaseSchema.superRefine(refineVehicle);
export type VehicleCreate = z.infer<typeof VehicleCreateSchema>;
export type VehicleCreateInput = z.input<typeof VehicleCreateSchema>;

/** `PATCH /vehicles/:id` (status changes go through `POST /vehicles/:id/status`). */
export const VehicleUpdateSchema = VehicleBaseSchema.omit({ status: true })
  .partial()
  .superRefine((v, ctx) => {
    // On PATCH the owner may already be stored; only reject an explicit removal.
    if (v.ownership === 'THIRD_PARTY' && v.ownerDriverId === null) refineVehicle(v, ctx);
  });
export type VehicleUpdate = z.infer<typeof VehicleUpdateSchema>;
export type VehicleUpdateInput = z.input<typeof VehicleUpdateSchema>;

/** `GET /vehicles?status&ownership&make&q` */
export const VehicleQuerySchema = pagination.extend({
  /** Matches plate (any format), VIN, make, model. */
  q: querySearch.optional(),
  status: queryList(VehicleStatus).optional(),
  ownership: queryList(VehicleOwnership).optional(),
  make: z.string().trim().min(1).max(60).optional(),
  isTaxi: queryBool.optional(),
  /** Manufacture year range, inclusive. */
  yearFrom: z.coerce.number().int().min(MIN_YEAR).max(2200).optional(),
  yearTo: z.coerce.number().int().min(MIN_YEAR).max(2200).optional(),
});
export type VehicleQuery = z.infer<typeof VehicleQuerySchema>;

/** `POST /vehicles/:id/status` */
export const VehicleStatusChangeSchema = z.object({
  status: VehicleStatus,
  note: optionalText(500),
});
export type VehicleStatusChange = z.infer<typeof VehicleStatusChangeSchema>;

/**
 * Status changes allowed through `POST /vehicles/:id/status` (target statuses per current
 * status). Extra server-side rules: LEASED -> IN_STOCK only without an open lease segment;
 * EXTERNAL -> IN_STOCK makes the car OWNED and opens an OWNED cycle; IN_STOCK -> SCRAPPED closes
 * the open cycle. SOLD is never set here (sales come from deals), LEASED comes from leases.
 */
export const MANUAL_VEHICLE_STATUS_TRANSITIONS: Readonly<
  Record<VehicleStatus, readonly VehicleStatus[]>
> = Object.freeze({
  IN_STOCK: ['RESERVED', 'SCRAPPED'],
  RESERVED: ['IN_STOCK'],
  LEASED: ['IN_STOCK'],
  SOLD: [],
  RETURNED: [],
  SCRAPPED: [],
  EXTERNAL: ['IN_STOCK'],
});

/* ------------------------------------------------------------------------------------------ */
/* Expenses                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const ExpenseBaseSchema = z.object({
  category: ExpenseCategory,
  date: isoDate,
  amount: positiveMoney,
  vatIncluded: z.boolean().default(true),
  /** Input VAT can be reclaimed (bought from a VAT-registered business). */
  vatReclaimable: z.boolean().default(false),
  paidBy: PaidBy.default('US'),
  /** Garage / supplier contact. */
  vendorId: idString.nullish(),
  /** Omitted -> linked to the vehicle's open inventory cycle (if any). */
  cycleId: idString.nullish(),
  description: optionalText(1000),
});

/** `POST /vehicles/:id/expenses` */
export const ExpenseCreateSchema = ExpenseBaseSchema;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseCreateInput = z.input<typeof ExpenseCreateSchema>;

/** `PATCH /expenses/:id` */
export const ExpenseUpdateSchema = ExpenseBaseSchema.partial();
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;
export type ExpenseUpdateInput = z.input<typeof ExpenseUpdateSchema>;

/** `GET /vehicles/:id/expenses` (and reports) */
export const ExpenseQuerySchema = pagination.extend({
  category: queryList(ExpenseCategory).optional(),
  paidBy: PaidBy.optional(),
  cycleId: idString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ExpenseQuery = z.infer<typeof ExpenseQuerySchema>;

/** Expense category -> ledger charge kind used when it is passed on to a driver. */
export const EXPENSE_TO_CHARGE_KIND: Readonly<Record<ExpenseCategory, ChargeKind>> = Object.freeze({
  REPAIR: 'REPAIR',
  TEST: 'TEST',
  INSURANCE: 'INSURANCE',
  FUEL: 'OTHER',
  TOWING: 'REPAIR',
  PARTS: 'REPAIR',
  CLEANING: 'OTHER',
  FINE: 'FINE',
  LICENSE_FEE: 'OTHER',
  METER: 'REPAIR',
  OTHER: 'OTHER',
});

/**
 * `POST /expenses/:id/rebill`: creates a CHARGE on the driver's ledger. Driver and contract
 * default to the lease segment holding the vehicle on the expense date.
 */
export const ExpenseRebillSchema = z.object({
  driverId: idString.optional(),
  contractId: idString.optional(),
  /** Defaults to the expense amount. */
  amount: positiveMoney.optional(),
  /** Defaults to `EXPENSE_TO_CHARGE_KIND[category]`. */
  chargeKind: ChargeKind.exclude(['RENT']).optional(),
  dueDate: isoDate.optional(),
  description: optionalText(500),
});
export type ExpenseRebill = z.infer<typeof ExpenseRebillSchema>;

/* ------------------------------------------------------------------------------------------ */
/* Insurance                                                                                  */
/* ------------------------------------------------------------------------------------------ */

/** Policy types that cover the business rather than one vehicle. */
export const BUSINESS_INSURANCE_TYPES: readonly InsuranceType[] = ['TRADE', 'LOT'];

/**
 * i18n key (namespace `common`): an insurance policy must end after it starts
 * (`endDate > startDate`). Field error on `endDate` of the insurance endpoints.
 */
export const INSURANCE_END_AFTER_START = 'validation.endAfterStart';

const InsuranceBaseSchema = z.object({
  scope: InsuranceScope.default('VEHICLE'),
  /** Required for VEHICLE scope (path param on `/vehicles/:id/insurance`); null for BUSINESS. */
  vehicleId: idString.nullish(),
  type: InsuranceType,
  insurer: z.string().trim().min(1).max(100),
  policyNo: optionalText(60),
  startDate: isoDate,
  endDate: isoDate,
  premium: nonNegativeMoney.nullish(),
  paidBy: PaidBy.default('US'),
  /** Comprehensive policy extended for taxi use. */
  hasTaxiExtension: z.boolean().default(false),
});

function refineInsurance(
  v: {
    scope?: InsuranceScope;
    vehicleId?: string | null;
    type?: InsuranceType;
    startDate?: string;
    endDate?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: INSURANCE_END_AFTER_START,
    });
  }
  if (v.scope === 'BUSINESS' && v.vehicleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vehicleId'],
      message: msg.businessScopeNoVehicle,
    });
  }
  if (v.type && BUSINESS_INSURANCE_TYPES.includes(v.type) && v.scope === 'VEHICLE') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scope'], message: msg.businessPolicyType });
  }
}

/**
 * `POST /vehicles/:id/insurance` (vehicleId from the path) or `POST /insurance`
 * (BUSINESS scope: TRADE / LOT policies, no vehicle).
 */
export const InsuranceCreateSchema = InsuranceBaseSchema.superRefine(refineInsurance);
export type InsuranceCreate = z.infer<typeof InsuranceCreateSchema>;
export type InsuranceCreateInput = z.input<typeof InsuranceCreateSchema>;

/** `POST /insurance`: business-level policy (TRADE / LOT), never linked to a vehicle. */
export const BusinessInsuranceCreateSchema = InsuranceBaseSchema.extend({
  scope: z.literal('BUSINESS').default('BUSINESS'),
}).superRefine(refineInsurance);
export type BusinessInsuranceCreate = z.infer<typeof BusinessInsuranceCreateSchema>;
export type BusinessInsuranceCreateInput = z.input<typeof BusinessInsuranceCreateSchema>;

/** `PATCH /insurance/:id` */
export const InsuranceUpdateSchema = InsuranceBaseSchema.partial().superRefine(refineInsurance);
export type InsuranceUpdate = z.infer<typeof InsuranceUpdateSchema>;
export type InsuranceUpdateInput = z.input<typeof InsuranceUpdateSchema>;

/** `GET /insurance` / `GET /vehicles/:id/insurance` */
export const InsuranceQuerySchema = pagination.extend({
  scope: InsuranceScope.optional(),
  vehicleId: idString.optional(),
  type: queryList(InsuranceType).optional(),
  /** Policies ending on/before this date. */
  endingBefore: isoDate.optional(),
  /** Only policies active today. */
  activeOnly: queryBool.optional(),
});
export type InsuranceQuery = z.infer<typeof InsuranceQuerySchema>;

/* ------------------------------------------------------------------------------------------ */
/* Odometer                                                                                   */
/* ------------------------------------------------------------------------------------------ */

const OdometerBaseSchema = z.object({
  km: z.number().int().min(0).max(3_000_000),
  date: isoDate,
  /** Where the reading came from (handover, test, service...). */
  source: optionalText(60),
});

/** `POST /vehicles/:id/odometer` (also updates `Vehicle.currentKm` when it is the latest). */
export const OdometerCreateSchema = OdometerBaseSchema;
export type OdometerCreate = z.infer<typeof OdometerCreateSchema>;
export type OdometerCreateInput = z.input<typeof OdometerCreateSchema>;

export const OdometerUpdateSchema = OdometerBaseSchema.partial();
export type OdometerUpdate = z.infer<typeof OdometerUpdateSchema>;

/** `GET /vehicles/:id/odometer` */
export const OdometerQuerySchema = pagination.extend({
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type OdometerQuery = z.infer<typeof OdometerQuerySchema>;

/* ------------------------------------------------------------------------------------------ */
/* Consignment cycle                                                                          */
/* ------------------------------------------------------------------------------------------ */

/**
 * `POST /vehicles/:id/consign`: opens a CONSIGNED inventory cycle.
 * PERCENT: `commissionValue` is a percent (<= 100). SURPLUS: `minNetToConsignor` is required and
 * `commissionValue` is ignored (we keep everything above the minimum net).
 */
export const ConsignSchema = z
  .object({
    consignorId: idString,
    /** Defaults to today (business time zone). */
    startedAt: isoDate.optional(),
    askingPrice: positiveMoney,
    minNetToConsignor: nonNegativeMoney.nullish(),
    commissionMode: CommissionMode,
    commissionValue: nonNegativeMoney.nullish(),
    agreementEndsAt: optionalIsoDate,
  })
  .superRefine((v, ctx) => {
    if (v.commissionMode === 'PERCENT' && (v.commissionValue ?? 0) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commissionValue'],
        message: msg.invalidPercent,
      });
    }
    if (
      v.commissionMode !== 'SURPLUS' &&
      (v.commissionValue === null || v.commissionValue === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commissionValue'],
        message: msg.required,
      });
    }
    if (
      v.commissionMode === 'SURPLUS' &&
      (v.minNetToConsignor === null || v.minNetToConsignor === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minNetToConsignor'],
        message: msg.minNetRequired,
      });
    }
    if (v.startedAt && v.agreementEndsAt && v.agreementEndsAt < v.startedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agreementEndsAt'],
        message: msg.endBeforeStart,
      });
    }
  });
export type Consign = z.infer<typeof ConsignSchema>;
export type ConsignInput = z.input<typeof ConsignSchema>;

/** `POST /cycles/:id/return`: consignment car returned to its owner (RETURNED_TO_CONSIGNOR). */
export const CycleReturnSchema = z.object({
  /** Defaults to today. */
  date: isoDate.optional(),
  notes: optionalText(1000),
  /** Alias of `notes`. */
  note: optionalText(1000),
});
export type CycleReturn = z.infer<typeof CycleReturnSchema>;
