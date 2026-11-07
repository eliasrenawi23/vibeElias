import { z } from 'zod';
import { FineStatus } from '../enums.js';
import {
  idString,
  isoDate,
  isoDateTime,
  optionalIsoDate,
  optionalText,
  pagination,
  positiveMoney,
  queryList,
  querySearch,
} from '../primitives.js';

const FineBaseSchema = z.object({
  vehicleId: idString,
  /** Override the auto-match (driver of the segment holding the car at `offenceAt`). */
  driverId: idString.nullish(),
  contractId: idString.nullish(),
  fineNo: optionalText(50),
  /** Police, municipality, toll road operator... */
  authority: optionalText(100),
  offenceAt: isoDateTime,
  receivedAt: isoDate,
  amount: positiveMoney,
  status: FineStatus.default('NEW'),
  /** Defaults to `receivedAt + 90 days` (see `fineReassignDeadline`). */
  reassignDeadline: optionalIsoDate,
  notes: optionalText(2000),
});

/** `POST /fines` (auto-matches the driver/contract from the open lease segment). */
export const FineCreateSchema = FineBaseSchema;
export type FineCreate = z.infer<typeof FineCreateSchema>;
export type FineCreateInput = z.input<typeof FineCreateSchema>;

/** `PATCH /fines/:id` */
export const FineUpdateSchema = FineBaseSchema.partial();
export type FineUpdate = z.infer<typeof FineUpdateSchema>;
export type FineUpdateInput = z.input<typeof FineUpdateSchema>;

/** `GET /fines?status` */
export const FineQuerySchema = pagination.extend({
  q: querySearch.optional(),
  status: queryList(FineStatus).optional(),
  vehicleId: idString.optional(),
  driverId: idString.optional(),
  /** Reassignment deadline on/before this date. */
  deadlineBefore: isoDate.optional(),
});
export type FineQuery = z.infer<typeof FineQuerySchema>;

/**
 * `POST /fines/:id/rebill`: we paid the fine (status PAID_BY_US) and charge the driver
 * (CHARGE / FINE entry linked via `chargeEntryId`).
 */
export const FineRebillSchema = z.object({
  /** Defaults to the matched driver. */
  driverId: idString.optional(),
  /** Defaults to the fine amount. */
  amount: positiveMoney.optional(),
  /** Defaults to today. */
  date: isoDate.optional(),
  dueDate: isoDate.optional(),
  description: optionalText(500),
});
export type FineRebill = z.infer<typeof FineRebillSchema>;
