import { z } from 'zod';
import { AuditAction } from '../enums.js';
import { isoDateTime } from '../primitives.js';

/** `GET /dashboard/kpis`. */
export const DashboardKpisSchema = z.object({
  /** Vehicles with status IN_STOCK. */
  vehiclesInStock: z.number().int(),
  /** ACTIVE lease contracts. */
  activeLeases: z.number().int(),
  /** Sum of the positive driver balances. */
  receivables: z.number(),
  /** Profit of the inventory cycles closed this month (vehicle P&L rules). */
  monthProfit: z.number(),
  /** DRAFT + PENDING deals. */
  openDeals: z.number().int(),
  /** Completed sales past `transferDueAt` with the transfer not DONE. */
  transfersOverdue: z.number().int(),
  /** Reminders feed counts (all kinds, 30-day window): overdue and due items. */
  expiring: z.object({ overdue: z.number().int(), due: z.number().int() }),
  /** Fines still to be handled (status NEW or REASSIGN_SUBMITTED). */
  finesOpen: z.number().int(),
  /** Open driver charges past their due date (ageing buckets 1-30 ... 90+). */
  receivablesOverdue: z.number(),
});
export type DashboardKpis = z.infer<typeof DashboardKpisSchema>;

/** `GET /dashboard/activity?limit=20` */
export const DashboardActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type DashboardActivityQuery = z.infer<typeof DashboardActivityQuerySchema>;

/** One recent change (an `AuditLog` row), newest first. */
export const ActivityItemSchema = z.object({
  id: z.string(),
  at: isoDateTime,
  userName: z.string().nullable(),
  /** Audited entity (Prisma model name, e.g. `Vehicle`, `LeaseContract`). */
  entity: z.string(),
  entityId: z.string(),
  action: AuditAction,
  /** Short English summary built from the diff, e.g. `Vehicle 84-731-26 status → LEASED`. */
  summary: z.string(),
  /** Display name of the entity (plate, deal no., person...); null when unknown. */
  label: z.string().nullable(),
  /** Changed field names of an UPDATE (empty otherwise). */
  changes: z.array(z.string()),
  /** SPA path of the entity (or of its parent); null when it has no page. */
  link: z.string().nullable(),
});
export type ActivityItem = z.infer<typeof ActivityItemSchema>;

/** `GET /dashboard/charts?months=12` */
export const DashboardChartsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});
export type DashboardChartsQuery = z.infer<typeof DashboardChartsQuerySchema>;

export const DashboardChartsSchema = z.object({
  /** Oldest month first, current month last. */
  profitByMonth: z.array(
    z.object({
      period: z.string(),
      /** Sale prices of OWNED cycles closed in the month. */
      sales: z.number(),
      /** Driver charges minus credits by entry date (expense rebills excluded). */
      leaseIncome: z.number(),
      /** Commissions of CONSIGNED cycles closed in the month. */
      commission: z.number(),
      /** Purchase + expenses (net of rebills) + VAT of the cycles closed in the month. */
      costs: z.number(),
      profit: z.number(),
    }),
  ),
  /** Open driver charges by days past due (today, Asia/Jerusalem). */
  receivablesAgeing: z.object({
    current: z.number(),
    d1_30: z.number(),
    d31_60: z.number(),
    d61_90: z.number(),
    d90_plus: z.number(),
  }),
  /**
   * Vehicle counts: OWNED cars IN_STOCK / RESERVED / LEASED, and CONSIGNED cars in stock
   * (IN_STOCK or RESERVED).
   */
  inventory: z.object({
    inStock: z.number().int(),
    reserved: z.number().int(),
    leased: z.number().int(),
    consigned: z.number().int(),
  }),
});
export type DashboardCharts = z.infer<typeof DashboardChartsSchema>;
