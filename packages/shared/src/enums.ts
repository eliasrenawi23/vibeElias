import { z } from 'zod';

/*
 * Zod enums mirroring the Prisma enums of apps/api/prisma/schema.prisma one-to-one
 * (same names, same values, same order). `test/enums.test.ts` guards the mirror.
 * Each enum is exported both as a zod schema (value) and as a TS union type (same name).
 */

export const Role = z.enum(['ADMIN', 'SALES', 'ACCOUNTANT']);
export type Role = z.infer<typeof Role>;

export const ContactTag = z.enum([
  'BUYER',
  'SELLER',
  'DRIVER',
  'LEAD',
  'SUPPLIER',
  'GARAGE',
  'INSURER',
  'CONSIGNOR',
]);
export type ContactTag = z.infer<typeof ContactTag>;

export const DriverStatus = z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']);
export type DriverStatus = z.infer<typeof DriverStatus>;

export const VehicleStatus = z.enum([
  'IN_STOCK',
  'RESERVED',
  'LEASED',
  'SOLD',
  'RETURNED',
  'SCRAPPED',
  'EXTERNAL',
]);
export type VehicleStatus = z.infer<typeof VehicleStatus>;

export const VehicleOwnership = z.enum(['OWNED', 'CONSIGNED', 'THIRD_PARTY']);
export type VehicleOwnership = z.infer<typeof VehicleOwnership>;

export const Fuel = z.enum(['PETROL', 'DIESEL', 'HYBRID', 'PLUGIN_HYBRID', 'ELECTRIC', 'LPG']);
export type Fuel = z.infer<typeof Fuel>;

export const Gearbox = z.enum(['AUTO', 'MANUAL']);
export type Gearbox = z.infer<typeof Gearbox>;

export const CycleKind = z.enum(['OWNED', 'CONSIGNED']);
export type CycleKind = z.infer<typeof CycleKind>;

export const CycleEndReason = z.enum(['SOLD', 'RETURNED_TO_CONSIGNOR', 'SCRAPPED', 'CANCELLED']);
export type CycleEndReason = z.infer<typeof CycleEndReason>;

export const CommissionMode = z.enum(['FIXED', 'PERCENT', 'SURPLUS']);
export type CommissionMode = z.infer<typeof CommissionMode>;

export const ExpenseCategory = z.enum([
  'REPAIR',
  'TEST',
  'INSURANCE',
  'FUEL',
  'TOWING',
  'PARTS',
  'CLEANING',
  'FINE',
  'LICENSE_FEE',
  'METER',
  'OTHER',
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export const InsuranceType = z.enum(['COMPULSORY', 'THIRD_PARTY', 'COMPREHENSIVE', 'TRADE', 'LOT']);
export type InsuranceType = z.infer<typeof InsuranceType>;

export const InsuranceScope = z.enum(['VEHICLE', 'BUSINESS']);
export type InsuranceScope = z.infer<typeof InsuranceScope>;

export const PaidBy = z.enum(['US', 'DRIVER', 'CONSIGNOR']);
export type PaidBy = z.infer<typeof PaidBy>;

export const TaxiLicenseStatus = z.enum(['ACTIVE', 'SUSPENDED', 'TRANSFER_PENDING', 'SOLD']);
export type TaxiLicenseStatus = z.infer<typeof TaxiLicenseStatus>;

export const LeaseType = z.enum(['NUMBER_ONLY', 'CAR_AND_NUMBER']);
export type LeaseType = z.infer<typeof LeaseType>;

/** WEEKLY is schema-ready but not implemented in v1. */
export const BillingPeriod = z.enum(['MONTHLY', 'WEEKLY']);
export type BillingPeriod = z.infer<typeof BillingPeriod>;

export const LeaseStatus = z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED']);
export type LeaseStatus = z.infer<typeof LeaseStatus>;

export const LeaseEndReason = z.enum([
  'EXPIRED',
  'RENEWED',
  'TERMINATED_BY_US',
  'TERMINATED_BY_DRIVER',
  'OTHER',
]);
export type LeaseEndReason = z.infer<typeof LeaseEndReason>;

export const DepositKind = z.enum(['CASH', 'CHECK', 'PROMISSORY_NOTE']);
export type DepositKind = z.infer<typeof DepositKind>;

export const LedgerType = z.enum([
  'CHARGE',
  'PAYMENT',
  'CREDIT',
  'DEPOSIT_IN',
  'DEPOSIT_OUT',
  'DEPOSIT_APPLIED',
]);
export type LedgerType = z.infer<typeof LedgerType>;

export const ChargeKind = z.enum([
  'RENT',
  'FINE',
  'DAMAGE',
  'INSURANCE',
  'TEST',
  'REPAIR',
  'PENALTY',
  'OTHER',
]);
export type ChargeKind = z.infer<typeof ChargeKind>;

export const PaymentMethod = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CHECK',
  'BIT',
  'CREDIT_CARD',
  'TRADE_IN',
  'OFFSET',
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const DealType = z.enum(['PURCHASE', 'SALE', 'CONSIGNMENT_SALE']);
export type DealType = z.infer<typeof DealType>;

export const DealStatus = z.enum(['DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED']);
export type DealStatus = z.infer<typeof DealStatus>;

export const VatMode = z.enum(['NONE', 'FULL', 'MARGIN']);
export type VatMode = z.infer<typeof VatMode>;

export const TransferStatus = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE']);
export type TransferStatus = z.infer<typeof TransferStatus>;

export const Direction = z.enum(['IN', 'OUT']);
export type Direction = z.infer<typeof Direction>;

export const FineStatus = z.enum([
  'NEW',
  'REASSIGN_SUBMITTED',
  'REASSIGNED',
  'PAID_BY_US',
  'CANCELLED',
]);
export type FineStatus = z.infer<typeof FineStatus>;

export const DocKind = z.enum([
  'CAR_LICENSE',
  'INSURANCE',
  'ID',
  'DRIVER_LICENSE',
  'TAXI_PERMIT',
  'MEDICAL',
  'TAXI_LICENSE',
  'LICENSE_ASSIGNMENT_FORM',
  'CONTRACT',
  'AGREEMENT',
  'DISCLOSURE_FORM',
  'HANDOVER',
  'PHOTO',
  'RECEIPT',
  'FORM',
  'OTHER',
]);
export type DocKind = z.infer<typeof DocKind>;

export const AuditAction = z.enum(['CREATE', 'UPDATE', 'DELETE']);
export type AuditAction = z.infer<typeof AuditAction>;

/** Registry of every Prisma enum mirrored here (key = Prisma enum name). */
export const prismaEnums = {
  Role,
  ContactTag,
  DriverStatus,
  VehicleStatus,
  VehicleOwnership,
  Fuel,
  Gearbox,
  CycleKind,
  CycleEndReason,
  CommissionMode,
  ExpenseCategory,
  InsuranceType,
  InsuranceScope,
  PaidBy,
  TaxiLicenseStatus,
  LeaseType,
  BillingPeriod,
  LeaseStatus,
  LeaseEndReason,
  DepositKind,
  LedgerType,
  ChargeKind,
  PaymentMethod,
  DealType,
  DealStatus,
  VatMode,
  TransferStatus,
  Direction,
  FineStatus,
  DocKind,
  AuditAction,
} as const;
export type PrismaEnumName = keyof typeof prismaEnums;

/* ------------------------------------------------------------------------------------------ */
/* Application enums that are NOT Prisma enums (stored as strings / inside JSON columns).      */
/* ------------------------------------------------------------------------------------------ */

/** UI language. `User.locale`, `Contact.preferredLang` and `Document.lang` hold these values. */
export const Locale = z.enum(['he', 'ar', 'en']);
export type Locale = z.infer<typeof Locale>;

/** UI theme preference (`User.theme`). */
export const Theme = z.enum(['light', 'dark', 'system']);
export type Theme = z.infer<typeof Theme>;

/** Who carries a cost in a lease (`LeaseContract.responsibilities`, `Settings.defaultLeaseTerms`). */
export const ResponsibleParty = z.enum(['US', 'DRIVER']);
export type ResponsibleParty = z.infer<typeof ResponsibleParty>;

/** Fuel gauge reading recorded on handover / return checklists. */
export const FuelLevel = z.enum(['EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL']);
export type FuelLevel = z.infer<typeof FuelLevel>;

/** Entity types a manual reminder / feed item / audit row can point to (`Reminder.entityType`). */
export const EntityType = z.enum([
  'VEHICLE',
  'TAXI_LICENSE',
  'DRIVER',
  'CONTACT',
  'LEASE',
  'DEAL',
  'FINE',
  'INSURANCE',
  'DOCUMENT',
  'LEDGER_ENTRY',
]);
export type EntityType = z.infer<typeof EntityType>;

/** Kinds of items in the reminders feed (`GET /reminders/feed`). */
export const ReminderKind = z.enum([
  'REGISTRATION', // vehicle licence / annual test expiry
  'INSURANCE', // policy end date
  'DRIVER_LICENSE',
  'TAXI_PERMIT',
  'MEDICAL',
  'TAXI_LICENSE_FEE', // annual operating-licence fee (December slip)
  'TAXI_LICENSE_RENEWAL',
  'TAXI_AGE', // vehicle approaching / past the taxi age limits
  'LEASE_END',
  'DOCUMENT', // document expiresAt
  'DEALER_REGISTRATION', // 12-month dealer-registration cap
  'TRANSFER', // ownership transfer due (6 working days)
  'FINE_REASSIGN', // fine reassignment deadline
  'FOLLOW_UP', // contact / lead follow-up date
  'MANUAL', // manual Reminder row
]);
export type ReminderKind = z.infer<typeof ReminderKind>;

/** Deposit action of `POST /leases/:id/deposit`. */
export const DepositAction = z.enum(['IN', 'OUT', 'APPLY']);
export type DepositAction = z.infer<typeof DepositAction>;

/**
 * Computed vehicle alert codes (`alerts` on `GET /vehicles` items and `GET /vehicles/:id`).
 * Not a labelled enum: the web translates them under its own key group.
 * - registrationExpired: vehicle licence / annual test date has passed
 * - registrationExpiring: expires within `Settings.reminderLeadDays.registration` days
 * - dealerRegistration11Months: >= 11 months on dealer registration (12-month cap)
 * - taxiAge10: taxi >= 10 years old (semi-annual test regime)
 * - taxiAgeNearLimit: taxi >= 11.5 years old, not yet blocked
 * - taxiAgeBlocked: taxi >= 12 years old (cannot carry a taxi licence)
 */
export const VehicleAlert = z.enum([
  'registrationExpired',
  'registrationExpiring',
  'dealerRegistration11Months',
  'taxiAge10',
  'taxiAgeNearLimit',
  'taxiAgeBlocked',
]);
export type VehicleAlert = z.infer<typeof VehicleAlert>;

/** Sort direction for list queries. */
export const SortOrder = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof SortOrder>;

/** Enums that have translated labels under `enums.<Name>.<VALUE>` in the locale files. */
export const labelledEnums = {
  ...prismaEnums,
  ResponsibleParty,
  FuelLevel,
  EntityType,
  ReminderKind,
  DepositAction,
} as const;
export type LabelledEnumName = keyof typeof labelledEnums;

/** Value union of a labelled enum by name, e.g. `EnumValue<'VehicleStatus'>`. */
export type EnumValue<N extends LabelledEnumName> = z.infer<(typeof labelledEnums)[N]>;

/** All values of an enum by name, in declaration order. */
export function enumValues<N extends LabelledEnumName>(name: N): readonly EnumValue<N>[] {
  return labelledEnums[name].options as readonly EnumValue<N>[];
}

/** Type guard: is `value` a member of the named enum? */
export function isEnumValue<N extends LabelledEnumName>(
  name: N,
  value: unknown,
): value is EnumValue<N> {
  return (
    typeof value === 'string' && (labelledEnums[name].options as readonly string[]).includes(value)
  );
}

/** i18n key of an enum value label, e.g. `enumLabelKey('VehicleStatus', 'SOLD')` -> `enums.VehicleStatus.SOLD`. */
export function enumLabelKey<N extends LabelledEnumName>(name: N, value: EnumValue<N>): string {
  return `enums.${name}.${value}`;
}
