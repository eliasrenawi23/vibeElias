import { z } from 'zod';
import { DealStatus, FineStatus, LeaseStatus, VehicleStatus } from '../enums.js';

/**
 * `GET /{vehicles,leases,deals,fines}/summary`: one count per status (every enum value is
 * present, 0 when none) under the list's current filters, except `status` itself.
 */
export const StatusSummarySchema = z.object({
  counts: z.record(z.string(), z.number().int().min(0)),
});
export type StatusSummary<S extends string = string> = { counts: Record<S, number> };

function summaryFor<T extends z.ZodEnum<[string, ...string[]]>>(statuses: T) {
  return z.object({
    counts: z.record(statuses, z.number().int().min(0)) as unknown as z.ZodType<
      Record<z.infer<T>, number>
    >,
  });
}

export const VehicleSummarySchema = summaryFor(VehicleStatus);
export const LeaseSummarySchema = summaryFor(LeaseStatus);
export const DealSummarySchema = summaryFor(DealStatus);
export const FineSummarySchema = summaryFor(FineStatus);
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>;
export type LeaseSummary = z.infer<typeof LeaseSummarySchema>;
export type DealSummary = z.infer<typeof DealSummarySchema>;
export type FineSummary = z.infer<typeof FineSummarySchema>;
