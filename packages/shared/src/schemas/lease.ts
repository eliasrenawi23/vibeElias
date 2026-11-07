import { z } from 'zod';
import { HandoverChecklistSchema, ReturnChecklistSchema } from '../checklists.js';
import {
  BillingPeriod,
  DepositKind,
  LeaseEndReason,
  LeaseStatus,
  LeaseType,
  PaymentMethod,
  ResponsibleParty,
} from '../enums.js';
import { msg } from '../messages.js';
import {
  hasAtMost2Decimals,
  idString,
  isoDate,
  isoDateTime,
  nonNegativeMoney,
  optionalText,
  pagination,
  positiveMoney,
  queryList,
  querySearch,
  yearMonth,
} from '../primitives.js';

/* ------------------------------------------------------------------------------------------ */
/* Responsibilities (who pays what)                                                           */
/* ------------------------------------------------------------------------------------------ */

/** `LeaseContract.responsibilities` JSON. Default: the driver pays everything except the car. */
export const ResponsibilitiesSchema = z.object({
  insurance: ResponsibleParty.default('DRIVER'),
  test: ResponsibleParty.default('DRIVER'),
  repairs: ResponsibleParty.default('DRIVER'),
  fines: ResponsibleParty.default('DRIVER'),
});
export type Responsibilities = z.infer<typeof ResponsibilitiesSchema>;
export const RESPONSIBILITY_KEYS = ['insurance', 'test', 'repairs', 'fines'] as const;
export type ResponsibilityKey = (typeof RESPONSIBILITY_KEYS)[number];
export const DEFAULT_RESPONSIBILITIES: Readonly<Responsibilities> = Object.freeze({
  insurance: 'DRIVER',
  test: 'DRIVER',
  repairs: 'DRIVER',
  fines: 'DRIVER',
});

/** Payment day of month is limited to 1..28 so it exists in every month. */
export const paymentDay = z.number().int().min(1).max(28);

/** Early-exit penalty, in months of rent (0..12, 2 decimals, e.g. 1.5). */
export const penaltyMonths = z
  .number()
  .finite()
  .min(0)
  .max(12)
  .refine(hasAtMost2Decimals, { message: msg.invalidNumber });

/* ------------------------------------------------------------------------------------------ */
/* Contract (draft)                                                                           */
/* ------------------------------------------------------------------------------------------ */

const LeaseBaseSchema = z.object({
  driverId: idString,
  type: LeaseType,
  /** Only MONTHLY is implemented in v1. */
  billingPeriod: BillingPeriod.default('MONTHLY'),
  startDate: isoDate,
  /** Contract end (inclusive). */
  endDate: isoDate,
  paymentDay: paymentDay.default(1),
  rentIncludesVat: z.boolean().default(true),
  earlyExitPenaltyMonths: penaltyMonths.default(1),
  depositAmount: nonNegativeMoney.default(0),
  depositKind: DepositKind.default('CASH'),
  /** Omitted -> copied from `Settings.defaultLeaseTerms.responsibilities`. */
  responsibilities: ResponsibilitiesSchema.optional(),
  /** Contract-specific terms; omitted -> clauses from settings are used for the PDF. */
  terms: optionalText(20_000),
  signedAt: isoDateTime.nullish(),
});

function refineLease(
  v: { startDate?: string; endDate?: string; billingPeriod?: BillingPeriod },
  ctx: z.RefinementCtx,
) {
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: msg.endBeforeStart });
  }
  if (v.billingPeriod === 'WEEKLY') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingPeriod'],
      message: msg.weeklyNotSupported,
    });
  }
}

/** `POST /leases`: creates a DRAFT contract. Licence/car/rent are chosen on activation. */
export const LeaseCreateSchema = LeaseBaseSchema.superRefine(refineLease);
export type LeaseCreate = z.infer<typeof LeaseCreateSchema>;
export type LeaseCreateInput = z.input<typeof LeaseCreateSchema>;

/**
 * `PATCH /leases/:id`. Any field while DRAFT; once ACTIVE the server only accepts
 * `endDate`, `paymentDay`, `responsibilities`, `terms`, `signedAt`, `earlyExitPenaltyMonths`.
 */
export const LeaseUpdateSchema = LeaseBaseSchema.omit({ driverId: true })
  .extend({ terminationNote: optionalText(2000) })
  .partial()
  .superRefine(refineLease);
export type LeaseUpdate = z.infer<typeof LeaseUpdateSchema>;
export type LeaseUpdateInput = z.input<typeof LeaseUpdateSchema>;

/** `GET /leases?status&driverId&...` */
export const LeaseQuerySchema = pagination.extend({
  q: querySearch.optional(),
  status: queryList(LeaseStatus).optional(),
  type: LeaseType.optional(),
  driverId: idString.optional(),
  taxiLicenseId: idString.optional(),
  vehicleId: idString.optional(),
  /** Contracts whose endDate is on/before this date (expiring soon). */
  endingBefore: isoDate.optional(),
});
export type LeaseQuery = z.infer<typeof LeaseQuerySchema>;

/* ------------------------------------------------------------------------------------------ */
/* Activation, segments, end, renewal                                                         */
/* ------------------------------------------------------------------------------------------ */

/** Deposit received on activation (creates a `DEPOSIT_IN` entry + printable receipt). */
export const LeaseDepositInSchema = z.object({
  amount: positiveMoney,
  kind: DepositKind.default('CASH'),
  /** Cheque / promissory note number. */
  reference: optionalText(100),
  /** Defaults to the activation start date. */
  date: isoDate.optional(),
});

/**
 * `POST /leases/:id/activate`: opens the first segment, records the deposit and generates the
 * first rent charge(s). `vehicleId` is required for CAR_AND_NUMBER (checked server-side) and, for
 * NUMBER_ONLY, may point to the driver's own THIRD_PARTY car.
 */
export const LeaseActivateSchema = z.object({
  taxiLicenseId: idString,
  vehicleId: idString.nullish(),
  monthlyRent: positiveMoney,
  /** Defaults to the contract startDate. */
  startDate: isoDate.optional(),
  /** Omit when no deposit is taken; amount defaults to the contract depositAmount if omitted. */
  deposit: LeaseDepositInSchema.optional(),
  handoverChecklist: HandoverChecklistSchema.optional(),
  signedAt: isoDateTime.optional(),
});
export type LeaseActivate = z.infer<typeof LeaseActivateSchema>;
export type LeaseActivateInput = z.input<typeof LeaseActivateSchema>;

/**
 * `POST /leases/:id/segments`: car swap and/or rent change from `startDate`. The open segment is
 * closed the day before and a new one opened. Omitted fields are carried over from the open
 * segment; `vehicleId: null` removes the car.
 */
export const LeaseSegmentCreateSchema = z
  .object({
    startDate: isoDate,
    taxiLicenseId: idString.optional(),
    vehicleId: idString.nullish(),
    monthlyRent: positiveMoney.optional(),
    reason: optionalText(500),
  })
  .refine(
    (v) =>
      v.taxiLicenseId !== undefined || v.vehicleId !== undefined || v.monthlyRent !== undefined,
    { message: msg.nothingToChange, path: ['monthlyRent'] },
  );
export type LeaseSegmentCreate = z.infer<typeof LeaseSegmentCreateSchema>;
export type LeaseSegmentCreateInput = z.input<typeof LeaseSegmentCreateSchema>;

/** `POST /leases/:id/end`: ends (ENDED) or terminates early (TERMINATED) a contract. */
export const LeaseEndSchema = z.object({
  /** Last day of the lease (inclusive). Charged days after it are credited back. */
  actualEndDate: isoDate,
  endReason: LeaseEndReason.exclude(['RENEWED']),
  terminationNote: optionalText(2000),
  /** Add an early-exit PENALTY charge of `earlyExitPenaltyMonths x rent`. */
  applyPenalty: z.boolean().default(false),
  /** Override the contract's penalty months for this termination. */
  penaltyMonths: penaltyMonths.optional(),
  returnChecklist: ReturnChecklistSchema.optional(),
});
export type LeaseEnd = z.infer<typeof LeaseEndSchema>;
export type LeaseEndInput = z.input<typeof LeaseEndSchema>;

/**
 * `POST /leases/:id/renew`: ends the contract with reason RENEWED and creates an ACTIVE successor
 * (`renewedFromId`) starting the next day; segments carry over unless changed. Deposit stays at
 * driver level.
 */
export const LeaseRenewSchema = z
  .object({
    /** Defaults to the day after the current endDate. */
    startDate: isoDate.optional(),
    endDate: isoDate,
    monthlyRent: positiveMoney.optional(),
    paymentDay: paymentDay.optional(),
    earlyExitPenaltyMonths: penaltyMonths.optional(),
    responsibilities: ResponsibilitiesSchema.optional(),
    terms: optionalText(20_000),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate <= v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: msg.endBeforeStart });
    }
  });
export type LeaseRenew = z.infer<typeof LeaseRenewSchema>;
export type LeaseRenewInput = z.input<typeof LeaseRenewSchema>;

/**
 * `POST /leases/:id/deposit`:
 * - IN: deposit received (`DEPOSIT_IN`),
 * - OUT: deposit returned to the driver (`DEPOSIT_OUT`),
 * - APPLY: deposit applied to open debt (`DEPOSIT_APPLIED` + `PAYMENT` with method OFFSET).
 */
export const LeaseDepositActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('IN'),
    amount: positiveMoney,
    date: isoDate,
    kind: DepositKind,
    reference: optionalText(100),
    description: optionalText(500),
  }),
  z.object({
    action: z.literal('OUT'),
    amount: positiveMoney,
    date: isoDate,
    method: PaymentMethod.exclude(['TRADE_IN', 'OFFSET']).default('CASH'),
    reference: optionalText(100),
    description: optionalText(500),
  }),
  z.object({
    action: z.literal('APPLY'),
    amount: positiveMoney,
    date: isoDate,
    description: optionalText(500),
  }),
]);
export type LeaseDepositAction = z.infer<typeof LeaseDepositActionSchema>;
export type LeaseDepositActionInput = z.input<typeof LeaseDepositActionSchema>;

/** `PATCH /leases/:id/checklists` */
export const LeaseChecklistsSchema = z
  .object({
    handoverChecklist: HandoverChecklistSchema.optional(),
    returnChecklist: ReturnChecklistSchema.optional(),
  })
  .refine((v) => v.handoverChecklist !== undefined || v.returnChecklist !== undefined, {
    message: msg.nothingToChange,
  });
export type LeaseChecklists = z.infer<typeof LeaseChecklistsSchema>;
export type LeaseChecklistsInput = z.input<typeof LeaseChecklistsSchema>;

/* ------------------------------------------------------------------------------------------ */
/* Billing                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/** `GET /leases/billing/preview` and `POST /leases/billing/run`. */
export const LeaseBillingRunSchema = z.object({
  /** Generate rent charges up to and including this period (default: current month). */
  upto: yearMonth.optional(),
  /** Limit to one contract (default: all ACTIVE contracts). */
  contractId: idString.optional(),
});
export type LeaseBillingRun = z.infer<typeof LeaseBillingRunSchema>;
