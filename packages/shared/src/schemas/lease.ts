import { z } from 'zod';
import { HandoverChecklistSchema, ReturnChecklistSchema } from '../checklists.js';
import {
  BillingPeriod,
  DepositAction,
  DepositEndAction,
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

/**
 * Contract fields of a draft without the first segment. The API's `POST /leases` uses
 * `LeaseDraftCreateSchema` (these fields + the first segment); kept for compatibility.
 */
export const LeaseCreateSchema = LeaseBaseSchema.superRefine(refineLease);
export type LeaseCreate = z.infer<typeof LeaseCreateSchema>;
export type LeaseCreateInput = z.input<typeof LeaseCreateSchema>;

/**
 * Contract fields of `PATCH /leases/:id`; the API validates with `LeaseDraftUpdateSchema` (adds
 * the first-segment fields and `notes`). Any field while DRAFT; once ACTIVE the server only accepts
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
 * Earlier activation body that also chose the segment; the API's `POST /leases/:id/activate`
 * uses `LeaseActivationSchema` (the segment is created with the draft). Opens the first segment, records the deposit and generates the
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

/**
 * Earlier end body (`endReason`); the API's `POST /leases/:id/end` uses `LeaseEndRequestSchema`
 * (`reason`, deposit action). Ends (ENDED) or terminates early (TERMINATED) a contract.
 */
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
 * Earlier deposit body (date required, `kind` required for IN); the API's
 * `POST /leases/:id/deposit` uses `LeaseDepositRequestSchema`. Actions:
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
  period: yearMonth.optional(),
  /** Alias of `period` (kept for compatibility). */
  upto: yearMonth.optional(),
  /** Limit to one contract (default: all ACTIVE contracts). */
  contractId: idString.optional(),
});
export type LeaseBillingRun = z.infer<typeof LeaseBillingRunSchema>;

/* ------------------------------------------------------------------------------------------ */
/* API request bodies (milestone 3)                                                           */
/* ------------------------------------------------------------------------------------------ */

/** Message keys used by the lease request schemas below. */
export const leaseMsg = {
  /** Only MONTHLY billing is implemented (WEEKLY is schema-ready). */
  billingPeriodUnsupported: 'validation.billingPeriodUnsupported',
  /** endDate must be after startDate. */
  endAfterStart: 'validation.endAfterStart',
} as const;

/** Payment methods of deposits and deposit returns (TRADE_IN is deal-only, OFFSET internal). */
export const DepositPaymentMethod = PaymentMethod.exclude(['TRADE_IN', 'OFFSET']);
export type DepositPaymentMethod = z.infer<typeof DepositPaymentMethod>;

function refineLeaseDraft(
  v: { startDate?: string; endDate?: string; billingPeriod?: BillingPeriod },
  ctx: z.RefinementCtx,
) {
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: leaseMsg.endAfterStart,
    });
  }
  if (v.billingPeriod && v.billingPeriod !== 'MONTHLY') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['billingPeriod'],
      message: leaseMsg.billingPeriodUnsupported,
    });
  }
}

/**
 * `POST /leases`: creates a DRAFT contract together with its open first segment, which already
 * locks the licence (and the car). Responsibilities default to `Settings.defaultLeaseTerms`.
 */
export const LeaseDraftCreateSchema = LeaseBaseSchema.extend({
  taxiLicenseId: idString,
  /**
   * Required for CAR_AND_NUMBER (one of our taxis). Optional for NUMBER_ONLY: the driver's own
   * THIRD_PARTY car the licence is registered on. Checked server-side.
   */
  vehicleId: idString.nullish(),
  monthlyRent: positiveMoney,
  notes: optionalText(5000),
}).superRefine(refineLeaseDraft);
export type LeaseDraftCreate = z.infer<typeof LeaseDraftCreateSchema>;
export type LeaseDraftCreateInput = z.input<typeof LeaseDraftCreateSchema>;

/**
 * `PATCH /leases/:id`. DRAFT: any field incl. the first-segment fields. ACTIVE: only `endDate`
 * (not in the past), `paymentDay`, `terms`, `responsibilities`, `notes`; any other changed
 * field -> 409 `errors.leaseNotEditable`. ENDED / TERMINATED: 409 `errors.leaseNotEditable`.
 */
export const LeaseDraftUpdateSchema = LeaseBaseSchema.omit({ driverId: true })
  .extend({
    taxiLicenseId: idString,
    vehicleId: idString.nullish(),
    monthlyRent: positiveMoney,
    notes: optionalText(5000),
    terminationNote: optionalText(2000),
  })
  .partial()
  .superRefine(refineLeaseDraft);
export type LeaseDraftUpdate = z.infer<typeof LeaseDraftUpdateSchema>;
export type LeaseDraftUpdateInput = z.input<typeof LeaseDraftUpdateSchema>;

/** Deposit taken on activation; recorded as `DEPOSIT_IN` when the amount is > 0. */
export const LeaseActivationDepositSchema = z.object({
  /** Defaults to the contract `depositAmount`; 0 records nothing. */
  amount: nonNegativeMoney.optional(),
  /** How it was paid; defaults from `kind` (CASH -> CASH, CHECK -> CHECK). */
  method: DepositPaymentMethod.optional(),
  /** Defaults to the contract `depositKind`. */
  kind: DepositKind.optional(),
  /** Cheque / promissory note number. */
  reference: optionalText(100),
  /** Defaults to today. */
  date: isoDate.optional(),
});
export type LeaseActivationDeposit = z.infer<typeof LeaseActivationDepositSchema>;

/**
 * `POST /leases/:id/activate` (body optional): DRAFT -> ACTIVE. Re-checks driver, licence and
 * car, marks the car LEASED, records the deposit and generates rent charges up to this month.
 */
export const LeaseActivationSchema = z.object({
  /** Defaults to the draft's signedAt, else now. */
  signedAt: isoDateTime.optional(),
  deposit: LeaseActivationDepositSchema.optional(),
  handoverChecklist: HandoverChecklistSchema.optional(),
});
export type LeaseActivation = z.infer<typeof LeaseActivationSchema>;
export type LeaseActivationInput = z.input<typeof LeaseActivationSchema>;

/**
 * `POST /leases/:id/end`: ENDED (EXPIRED / OTHER) or TERMINATED (TERMINATED_BY_*). Credits the
 * charged days after `actualEndDate`, optionally adds the early-exit PENALTY and returns or
 * applies the held deposit.
 */
export const LeaseEndRequestSchema = z.object({
  /** Last day of the lease (inclusive). */
  actualEndDate: isoDate,
  reason: LeaseEndReason.exclude(['RENEWED']),
  /** Add a PENALTY charge of `earlyExitPenaltyMonths x current rent`. */
  applyPenalty: z.boolean().default(false),
  /** Override the contract's penalty months for this termination. */
  penaltyMonths: penaltyMonths.optional(),
  /** HOLD (default) keeps it; RETURN pays all of it back; APPLY offsets the open balance. */
  depositAction: DepositEndAction.default('HOLD'),
  /** Method of the deposit return (default CASH). */
  depositMethod: DepositPaymentMethod.optional(),
  /** Stored as the contract's `terminationNote`. */
  note: optionalText(2000),
  returnChecklist: ReturnChecklistSchema.optional(),
});
export type LeaseEndRequest = z.infer<typeof LeaseEndRequestSchema>;
export type LeaseEndRequestInput = z.input<typeof LeaseEndRequestSchema>;

/**
 * `POST /leases/:id/deposit`: IN (`DEPOSIT_IN`), OUT (`DEPOSIT_OUT`) or APPLY
 * (`DEPOSIT_APPLIED` + `PAYMENT` method OFFSET). OUT / APPLY are limited to the held amount.
 */
export const LeaseDepositRequestSchema = z.object({
  action: DepositAction,
  amount: positiveMoney,
  /** IN / OUT: how the money moved (IN defaults from `kind`, OUT to CASH). */
  method: DepositPaymentMethod.optional(),
  /** IN: deposit kind (defaults to the contract `depositKind`). */
  kind: DepositKind.optional(),
  reference: optionalText(100),
  /** Defaults to today. */
  date: isoDate.optional(),
  note: optionalText(500),
});
export type LeaseDepositRequest = z.infer<typeof LeaseDepositRequestSchema>;
export type LeaseDepositRequestInput = z.input<typeof LeaseDepositRequestSchema>;

/** `GET /leases/billing/preview?contractId&period` */
export const LeaseBillingPreviewQuerySchema = z.object({
  /** One contract (any status); omitted: every contract the billing run would process. */
  contractId: idString.optional(),
  /** Up to and including this month (default: current month). */
  period: yearMonth.optional(),
});
export type LeaseBillingPreviewQuery = z.infer<typeof LeaseBillingPreviewQuerySchema>;
