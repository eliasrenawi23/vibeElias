import {
  createHandoverChecklist,
  DEFAULT_RESPONSIBILITIES,
  DepositKind,
  HandoverChecklistSchema,
  idString,
  isoDate,
  LeaseType,
  msg,
  nonNegativeMoney,
  optionalText,
  paymentDay,
  penaltyMonths,
  positiveMoney,
  ResponsibilitiesSchema,
  todayInBusinessTz,
} from '@renawi/shared';
import { z } from 'zod';
import type { LeaseCreateBody } from '../api';
import { defaultEndDate } from '../lib/leaseRules';

/** Wizard steps in order (the last one reviews and creates the draft). */
export const LEASE_WIZARD_STEPS = [
  'driver',
  'license',
  'vehicle',
  'terms',
  'deposit',
  'review',
] as const;
export type LeaseWizardStep = (typeof LEASE_WIZARD_STEPS)[number];

/** Message when a car + licence lease has no car (an i18n key). */
export const VEHICLE_REQUIRED_MESSAGE = 'leases.wizard.vehicleRequired';

const LeaseWizardBaseSchema = z.object({
  driverId: idString,
  taxiLicenseId: idString,
  type: LeaseType,
  /** Our taxi (car + licence) or the driver's own car (licence only, optional). */
  vehicleId: idString.nullish(),
  startDate: isoDate,
  endDate: isoDate,
  monthlyRent: positiveMoney,
  paymentDay,
  rentIncludesVat: z.boolean(),
  earlyExitPenaltyMonths: penaltyMonths,
  responsibilities: ResponsibilitiesSchema,
  terms: optionalText(20_000),
  depositAmount: nonNegativeMoney,
  depositKind: DepositKind,
  handoverChecklist: HandoverChecklistSchema,
});

type BaseShape = typeof LeaseWizardBaseSchema.shape;
type WizardField = keyof BaseShape;

/** Fields validated by each step before "next". */
export const STEP_FIELDS: Readonly<Record<LeaseWizardStep, readonly WizardField[]>> = {
  driver: ['driverId'],
  license: ['taxiLicenseId'],
  vehicle: ['type', 'vehicleId'],
  terms: [
    'startDate',
    'endDate',
    'monthlyRent',
    'paymentDay',
    'rentIncludesVat',
    'earlyExitPenaltyMonths',
    'responsibilities',
    'terms',
  ],
  deposit: ['depositAmount', 'depositKind', 'handoverChecklist'],
  review: [],
};

type WizardValues = Partial<z.input<typeof LeaseWizardBaseSchema>>;

/** Cross-field rules, attributed to the step that owns the field. */
function crossFieldIssues(
  v: WizardValues,
): { step: LeaseWizardStep; path: string; message: string }[] {
  const out: { step: LeaseWizardStep; path: string; message: string }[] = [];
  if (v.type === 'CAR_AND_NUMBER' && !v.vehicleId) {
    out.push({ step: 'vehicle', path: 'vehicleId', message: VEHICLE_REQUIRED_MESSAGE });
  }
  if (v.startDate && v.endDate && v.endDate <= v.startDate) {
    out.push({ step: 'terms', path: 'endDate', message: msg.endBeforeStart });
  }
  return out;
}

/** The whole wizard (used on submit). */
export const LeaseWizardSchema = LeaseWizardBaseSchema.superRefine((v, ctx) => {
  for (const issue of crossFieldIssues(v)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: issue.path.split('.'),
      message: issue.message,
    });
  }
});
export type LeaseWizardInput = z.input<typeof LeaseWizardSchema>;
export type LeaseWizardOutput = z.output<typeof LeaseWizardSchema>;

export interface WizardIssue {
  /** Dot path of the field (`handoverChecklist.km`). */
  path: string;
  /** i18n message key (possibly with `::{params}`). */
  message: string;
}

/**
 * Validate one step on its own: the fields it owns plus its cross-field rules. The other steps'
 * fields are ignored, so "next" only depends on what the current step shows.
 */
export function validateLeaseStep(step: LeaseWizardStep, values: WizardValues): WizardIssue[] {
  const fields = STEP_FIELDS[step];
  if (fields.length === 0) return [];
  const mask = Object.fromEntries(fields.map((f) => [f, true])) as { [K in WizardField]?: true };
  const result = LeaseWizardBaseSchema.pick(mask).safeParse(values);
  const issues: WizardIssue[] = [];
  // One message per field: the first one zod reports (e.g. "required" before "invalid").
  for (const i of result.success ? [] : result.error.issues) {
    const path = i.path.join('.');
    if (!issues.some((x) => x.path === path)) issues.push({ path, message: i.message });
  }
  for (const issue of crossFieldIssues(values)) {
    if (issue.step === step && !issues.some((i) => i.path === issue.path)) {
      issues.push({ path: issue.path, message: issue.message });
    }
  }
  return issues;
}

/** First step (in order) that has a problem, for jumping back from the review. */
export function firstInvalidStep(values: WizardValues): LeaseWizardStep | null {
  return LEASE_WIZARD_STEPS.find((s) => validateLeaseStep(s, values).length > 0) ?? null;
}

/** Fresh wizard values (optionally with a preselected driver). */
export function defaultWizardValues(
  driverId?: string | null,
  today = todayInBusinessTz(),
): LeaseWizardInput {
  return {
    driverId: driverId ?? '',
    taxiLicenseId: '',
    type: 'CAR_AND_NUMBER',
    vehicleId: null,
    startDate: today,
    endDate: defaultEndDate(today),
    monthlyRent: undefined as unknown as number,
    paymentDay: 1,
    rentIncludesVat: true,
    earlyExitPenaltyMonths: 1,
    responsibilities: { ...DEFAULT_RESPONSIBILITIES },
    terms: '',
    depositAmount: 0,
    depositKind: 'CASH',
    handoverChecklist: { ...createHandoverChecklist(), date: today },
  };
}

/**
 * `POST /leases` body: the DRAFT contract and its first segment (licence, car, rent). The
 * handover checklist only applies when we hand over our car.
 */
export function toLeaseCreateBody(v: LeaseWizardOutput): LeaseCreateBody {
  return {
    driverId: v.driverId,
    type: v.type,
    billingPeriod: 'MONTHLY',
    startDate: v.startDate,
    endDate: v.endDate,
    paymentDay: v.paymentDay,
    rentIncludesVat: v.rentIncludesVat,
    earlyExitPenaltyMonths: v.earlyExitPenaltyMonths,
    depositAmount: v.depositAmount,
    depositKind: v.depositKind,
    responsibilities: v.responsibilities,
    terms: v.terms ?? null,
    taxiLicenseId: v.taxiLicenseId,
    vehicleId: v.vehicleId ?? null,
    monthlyRent: v.monthlyRent,
    handoverChecklist: v.type === 'CAR_AND_NUMBER' ? v.handoverChecklist : null,
  };
}
