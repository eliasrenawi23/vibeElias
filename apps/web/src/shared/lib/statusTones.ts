import type {
  ChargeKind,
  ContactTag,
  CycleKind,
  DealAlert,
  DealStatus,
  DealType,
  Direction,
  DriverAlert,
  DriverStatus,
  ExpenseCategory,
  FeedSeverity,
  FineAlert,
  FineStatus,
  LabelledEnumName,
  LeaseAlert,
  LeaseStatus,
  LeaseType,
  LedgerType,
  ResponsibleParty,
  TaxiLicenseAlert,
  TaxiLicenseStatus,
  TransferStatus,
  VehicleAlert,
  VehicleOwnership,
  VehicleStatus,
} from '@renawi/shared';
import type { ExpiryState } from './expiry';

/**
 * The one place that decides which colour a status, category or alert gets.
 *
 * A tone is a colour family from `@renawi/brand` tokens (text / soft background / border, light
 * and dark), drawn by the `.rm-tone-<tone>` classes in `styles/global.css`. Feature code never
 * picks a colour: it shows `StatusTag` / `ToneTag` / `AlertTags`, which read this registry.
 * Colour is never the only signal: every tone is shown with its translated label.
 *
 * - success: done, active, paid          - info: in progress, informational
 * - warning: needs attention soon        - error: overdue, blocked, terminated
 * - neutral: finished / inactive / other - accent: brand yellow (ours, leased, taxi)
 * - license: taxi-licence entities only  - purple: consignment, returned, paid by us
 */
export const TONES = [
  'success',
  'info',
  'warning',
  'error',
  'neutral',
  'accent',
  'license',
  'purple',
] as const;
export type Tone = (typeof TONES)[number];

/** Every value of an enum mapped to a tone: leaving a value out (or adding one) is a type error. */
export type ToneMap<V extends string> = Readonly<Record<V, Tone>>;

/** Tones per enum. Keys are the enum names of `@renawi/shared` (plus the web-only ExpiryState). */
export interface ToneRegistry {
  // Statuses (mapping confirmed by the owner, docs/plans/ui-patterns-from-hct.md A1).
  DriverStatus: ToneMap<DriverStatus>;
  VehicleStatus: ToneMap<VehicleStatus>;
  TaxiLicenseStatus: ToneMap<TaxiLicenseStatus>;
  LeaseStatus: ToneMap<LeaseStatus>;
  DealStatus: ToneMap<DealStatus>;
  TransferStatus: ToneMap<TransferStatus>;
  FineStatus: ToneMap<FineStatus>;
  CycleKind: ToneMap<CycleKind>;
  Direction: ToneMap<Direction>;
  /** Reminders feed severity (`FeedSeverity`: overdue / due / upcoming). */
  FeedSeverity: ToneMap<FeedSeverity>;
  // Categories.
  VehicleOwnership: ToneMap<VehicleOwnership>;
  LeaseType: ToneMap<LeaseType>;
  DealType: ToneMap<DealType>;
  ContactTag: ToneMap<ContactTag>;
  ChargeKind: ToneMap<ChargeKind>;
  LedgerType: ToneMap<LedgerType>;
  ExpenseCategory: ToneMap<ExpenseCategory>;
  ResponsibleParty: ToneMap<ResponsibleParty>;
  // Computed alert codes (`alerts` on list items and details).
  VehicleAlert: ToneMap<VehicleAlert>;
  TaxiLicenseAlert: ToneMap<TaxiLicenseAlert>;
  DriverAlert: ToneMap<DriverAlert>;
  LeaseAlert: ToneMap<LeaseAlert>;
  FineAlert: ToneMap<FineAlert>;
  DealAlert: ToneMap<DealAlert>;
  /** Document / licence expiry badges (`shared/lib/expiry.ts`). */
  ExpiryState: ToneMap<ExpiryState>;
}

export const TONE_REGISTRY: ToneRegistry = {
  DriverStatus: { ACTIVE: 'success', INACTIVE: 'neutral', BLACKLISTED: 'error' },
  VehicleStatus: {
    IN_STOCK: 'info',
    RESERVED: 'warning',
    LEASED: 'accent',
    SOLD: 'neutral',
    RETURNED: 'purple',
    SCRAPPED: 'neutral',
    EXTERNAL: 'neutral',
  },
  TaxiLicenseStatus: {
    ACTIVE: 'success',
    SUSPENDED: 'error',
    TRANSFER_PENDING: 'warning',
    SOLD: 'neutral',
  },
  LeaseStatus: { DRAFT: 'neutral', ACTIVE: 'success', ENDED: 'neutral', TERMINATED: 'error' },
  DealStatus: { DRAFT: 'neutral', PENDING: 'warning', COMPLETED: 'success', CANCELLED: 'neutral' },
  TransferStatus: { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', DONE: 'success' },
  FineStatus: {
    NEW: 'warning',
    REASSIGN_SUBMITTED: 'info',
    REASSIGNED: 'success',
    PAID_BY_US: 'purple',
    CANCELLED: 'neutral',
  },
  CycleKind: { OWNED: 'accent', CONSIGNED: 'purple' },
  Direction: { IN: 'success', OUT: 'warning' },
  FeedSeverity: { overdue: 'error', due: 'warning', upcoming: 'info' },

  VehicleOwnership: { OWNED: 'neutral', CONSIGNED: 'purple', THIRD_PARTY: 'neutral' },
  LeaseType: { NUMBER_ONLY: 'neutral', CAR_AND_NUMBER: 'neutral' },
  DealType: { PURCHASE: 'info', SALE: 'success', CONSIGNMENT_SALE: 'purple' },
  ContactTag: {
    BUYER: 'success',
    SELLER: 'info',
    DRIVER: 'accent',
    LEAD: 'warning',
    SUPPLIER: 'neutral',
    GARAGE: 'neutral',
    INSURER: 'neutral',
    CONSIGNOR: 'purple',
  },
  ChargeKind: {
    RENT: 'info',
    FINE: 'error',
    DAMAGE: 'warning',
    INSURANCE: 'purple',
    TEST: 'info',
    REPAIR: 'warning',
    PENALTY: 'error',
    OTHER: 'neutral',
  },
  LedgerType: {
    CHARGE: 'info',
    PAYMENT: 'success',
    CREDIT: 'accent',
    DEPOSIT_IN: 'purple',
    DEPOSIT_OUT: 'purple',
    DEPOSIT_APPLIED: 'purple',
  },
  ExpenseCategory: {
    REPAIR: 'warning',
    TEST: 'info',
    INSURANCE: 'purple',
    FUEL: 'accent',
    TOWING: 'warning',
    PARTS: 'info',
    CLEANING: 'neutral',
    FINE: 'error',
    LICENSE_FEE: 'license',
    METER: 'accent',
    OTHER: 'neutral',
  },
  ResponsibleParty: { US: 'accent', DRIVER: 'neutral' },

  VehicleAlert: {
    registrationExpired: 'error',
    registrationExpiring: 'warning',
    dealerRegistration11Months: 'warning',
    taxiAge10: 'info',
    taxiAgeNearLimit: 'warning',
    taxiAgeBlocked: 'error',
  },
  TaxiLicenseAlert: {
    annualFeeDue: 'warning',
    annualFeeOverdue: 'error',
    renewalDue: 'warning',
    renewalOverdue: 'error',
    idle: 'neutral',
  },
  DriverAlert: {
    licenseExpiring: 'warning',
    licenseExpired: 'error',
    taxiPermitExpiring: 'warning',
    taxiPermitExpired: 'error',
    medicalExpiring: 'warning',
    medicalExpired: 'error',
    overdue: 'error',
  },
  LeaseAlert: { endingSoon: 'warning', ended: 'neutral', overdue: 'error', draft: 'info' },
  FineAlert: { reassignDueSoon: 'warning', reassignOverdue: 'error' },
  DealAlert: {
    disclosureMissing: 'warning',
    transferDue: 'info',
    transferOverdue: 'error',
    unpaid: 'warning',
  },
  ExpiryState: { expired: 'error', soon: 'warning', valid: 'success' },
};

export type ToneEnumName = keyof ToneRegistry;

/** Registry enums with translated labels (`enums.<Name>.<VALUE>`): what `StatusTag` can show. */
export type LabelledToneEnumName = Extract<ToneEnumName, LabelledEnumName>;

/** Alert-code enums of the registry (shown by `AlertTags`). */
export type AlertEnumName = Extract<ToneEnumName, `${string}Alert`>;

/** Value union of a registry enum, e.g. `ToneValue<'LeaseStatus'>`. */
export type ToneValue<N extends ToneEnumName> = keyof ToneRegistry[N] & string;

/** Is `value` a value the registry knows for this enum? */
export function hasTone<N extends ToneEnumName>(
  enumName: N,
  value: string | null | undefined,
): value is ToneValue<N> {
  return typeof value === 'string' && Object.hasOwn(TONE_REGISTRY[enumName], value);
}

/** Tone of an enum value; unknown values (newer API, typo) fall back to neutral. */
export function toneOf<N extends ToneEnumName>(enumName: N, value: string | null | undefined): Tone {
  if (!hasTone(enumName, value)) return 'neutral';
  return (TONE_REGISTRY[enumName] as Readonly<Record<string, Tone>>)[value] ?? 'neutral';
}

/** Class names that paint an AntD `Tag` (or any element) in a tone. */
export function toneClassName(tone: Tone): string {
  return `rm-tone rm-tone-${tone}`;
}

/**
 * Solid colour of a tone as a CSS variable, for marks without a label of their own (timeline
 * dots). Neutral is the tertiary grey so a "closed" dot stays visible but quiet.
 */
export const TONE_DOT_COLORS: Readonly<Record<Tone, string>> = {
  success: 'var(--rm-color-success)',
  info: 'var(--rm-color-info)',
  warning: 'var(--rm-color-warning)',
  error: 'var(--rm-color-error)',
  neutral: 'var(--rm-color-text-tertiary)',
  accent: 'var(--rm-color-primary-text)',
  license: 'var(--rm-color-license)',
  purple: 'var(--rm-color-purple)',
};
