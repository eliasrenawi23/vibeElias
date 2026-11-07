import { z } from 'zod';
import { FuelLevel, type TransferStatus } from './enums.js';
import { isoDate, nonNegativeMoney, optionalText } from './primitives.js';

/**
 * JSON checklists stored on `Deal.transferChecklist`, `LeaseContract.handoverChecklist` and
 * `LeaseContract.returnChecklist`. Boolean items have typed key lists (for rendering and
 * i18n labels under `checklist.<list>.<key>`) plus default (all false / empty) objects.
 */

/* ------------------------------------------------------------------------------------------ */
/* Ownership transfer (deal)                                                                  */
/* ------------------------------------------------------------------------------------------ */

export const TRANSFER_CHECKLIST_KEYS = [
  'idCopies', // ID copies of buyer and seller collected
  'vehicleLicenseSigned', // vehicle licence (rishayon rechev) signed over
  'liensChecked', // liens / encumbrances checked
  'finesChecked', // outstanding fines checked
  'transferFiled', // transfer filed at the post office / online (+ fee)
  'newLicenseReceived', // new vehicle licence in the buyer's name received
  'insuranceHandled', // insurance cancelled or moved
  'taxiLicenseDetached', // taxis only: taxi licence detached from the vehicle
] as const;
export type TransferChecklistKey = (typeof TRANSFER_CHECKLIST_KEYS)[number];

export const TransferChecklistSchema = z.object({
  idCopies: z.boolean().default(false),
  vehicleLicenseSigned: z.boolean().default(false),
  liensChecked: z.boolean().default(false),
  finesChecked: z.boolean().default(false),
  transferFiled: z.boolean().default(false),
  newLicenseReceived: z.boolean().default(false),
  insuranceHandled: z.boolean().default(false),
  taxiLicenseDetached: z.boolean().default(false),
  /** Transfer fee paid (ILS 43 dealer transfer-in / ILS 257 regular, 2026). */
  transferFee: nonNegativeMoney.nullable().default(null),
  /** Date the transfer was filed. */
  filedAt: isoDate.nullable().default(null),
  notes: optionalText(2000).default(null),
});
export type TransferChecklist = z.infer<typeof TransferChecklistSchema>;

/** A fresh, empty transfer checklist. */
export function createTransferChecklist(): TransferChecklist {
  return TransferChecklistSchema.parse({});
}
export const DEFAULT_TRANSFER_CHECKLIST: Readonly<TransferChecklist> =
  Object.freeze(createTransferChecklist());

/** Items that apply to a vehicle (`taxiLicenseDetached` only for taxis). */
export function transferChecklistKeysFor(isTaxi: boolean): TransferChecklistKey[] {
  return TRANSFER_CHECKLIST_KEYS.filter((k) => isTaxi || k !== 'taxiLicenseDetached');
}

/** True when every applicable item is ticked. */
export function isTransferChecklistComplete(
  checklist: Partial<TransferChecklist> | null | undefined,
  isTaxi: boolean,
): boolean {
  if (!checklist) return false;
  return transferChecklistKeysFor(isTaxi).every((k) => checklist[k] === true);
}

/**
 * Transfer status implied by the ticked items: none -> NOT_STARTED, some -> IN_PROGRESS,
 * every applicable item -> DONE. (`PATCH /deals/:id/transfer` never lowers the stored status
 * unless a status is sent explicitly; an explicit DONE wins.)
 */
export function transferStatusFromChecklist(
  checklist: Partial<TransferChecklist> | null | undefined,
  isTaxi: boolean,
): TransferStatus {
  if (!checklist) return 'NOT_STARTED';
  const keys = transferChecklistKeysFor(isTaxi);
  const ticked = keys.filter((k) => checklist[k] === true).length;
  if (ticked === 0) return 'NOT_STARTED';
  return ticked === keys.length ? 'DONE' : 'IN_PROGRESS';
}

/* ------------------------------------------------------------------------------------------ */
/* Handover / return (lease)                                                                  */
/* ------------------------------------------------------------------------------------------ */

export const HANDOVER_CHECKLIST_KEYS = [
  'photosTaken',
  'spareWheel',
  'jack',
  'docsInCar',
  'damagesNoted',
  'meterSealed',
] as const;
export type HandoverChecklistKey = (typeof HANDOVER_CHECKLIST_KEYS)[number];

const conditionFields = {
  /** Date of the inspection. */
  date: isoDate.nullable().default(null),
  photosTaken: z.boolean().default(false),
  /** Odometer reading. */
  km: z.number().int().nonnegative().max(3_000_000).nullable().default(null),
  fuelLevel: FuelLevel.nullable().default(null),
  spareWheel: z.boolean().default(false),
  jack: z.boolean().default(false),
  /** Vehicle licence, insurance certificate etc. in the car. */
  docsInCar: z.boolean().default(false),
  /** Existing damages were reviewed and written down (see `damages`). */
  damagesNoted: z.boolean().default(false),
  /** Free-text description of damages. */
  damages: optionalText(2000).default(null),
  /** Taxi meter seal intact. */
  meterSealed: z.boolean().default(false),
  notes: optionalText(2000).default(null),
};

export const HandoverChecklistSchema = z.object(conditionFields);
export type HandoverChecklist = z.infer<typeof HandoverChecklistSchema>;

export const RETURN_CHECKLIST_KEYS = [
  ...HANDOVER_CHECKLIST_KEYS,
  'keysReturned',
  'newDamages',
] as const;
export type ReturnChecklistKey = (typeof RETURN_CHECKLIST_KEYS)[number];

export const ReturnChecklistSchema = z.object({
  ...conditionFields,
  /** All keys / remotes returned. */
  keysReturned: z.boolean().default(false),
  /** New damages found compared to the handover (describe in `damages`). */
  newDamages: z.boolean().default(false),
});
export type ReturnChecklist = z.infer<typeof ReturnChecklistSchema>;

/** A fresh, empty handover checklist. */
export function createHandoverChecklist(): HandoverChecklist {
  return HandoverChecklistSchema.parse({});
}
/** A fresh, empty return checklist. */
export function createReturnChecklist(): ReturnChecklist {
  return ReturnChecklistSchema.parse({});
}
export const DEFAULT_HANDOVER_CHECKLIST: Readonly<HandoverChecklist> =
  Object.freeze(createHandoverChecklist());
export const DEFAULT_RETURN_CHECKLIST: Readonly<ReturnChecklist> =
  Object.freeze(createReturnChecklist());
