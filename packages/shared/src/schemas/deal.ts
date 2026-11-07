import { z } from 'zod';
import { TransferChecklistSchema } from '../checklists.js';
import {
  DealStatus,
  DealType,
  Direction,
  PaymentMethod,
  TransferStatus,
  VatMode,
} from '../enums.js';
import { msg } from '../messages.js';
import {
  idString,
  isoDate,
  isoDateTime,
  nonNegativeMoney,
  optionalIsoDate,
  optionalText,
  pagination,
  percent,
  positiveMoney,
  queryBool,
  queryList,
  querySearch,
} from '../primitives.js';
import { VehicleBaseSchema } from './vehicle.js';

/**
 * Inline vehicle for a PURCHASE (or trade-in) of a car not yet in the system. The server upserts
 * by plate: an existing vehicle (buy-back) is relinked and gets a new inventory cycle.
 */
export const DealVehicleSchema = VehicleBaseSchema.pick({
  plateNo: true,
  vin: true,
  make: true,
  model: true,
  trim: true,
  year: true,
  color: true,
  fuel: true,
  gearbox: true,
  engineCc: true,
  hand: true,
  isTaxi: true,
  currentKm: true,
  registrationExpiry: true,
  notes: true,
});
export type DealVehicle = z.infer<typeof DealVehicleSchema>;

/**
 * Trade-in block of a SALE: creates a linked PURCHASE deal (`isTradeIn`) from the buyer for
 * `tradeInValue`, plus TRADE_IN payments on both deals. Cash due = price - tradeInValue.
 */
export const TradeInSchema = z
  .object({
    /** Existing vehicle (buy-back); otherwise `vehicle` is required. */
    vehicleId: idString.optional(),
    vehicle: DealVehicleSchema.optional(),
    /** Agreed trade-in value (the purchase price). */
    tradeInValue: positiveMoney,
    /** Price-guide reference (Levi Yitzhak). */
    listPrice: nonNegativeMoney.nullish(),
    sellerIsVatBusiness: z.boolean().default(false),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if ((v.vehicleId === undefined) === (v.vehicle === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicle'],
        message: msg.vehicleRequired,
      });
    }
  });
export type TradeIn = z.infer<typeof TradeInSchema>;
export type TradeInInput = z.input<typeof TradeInSchema>;

const DealFieldsSchema = z.object({
  /** Buyer (SALE / CONSIGNMENT_SALE) or seller (PURCHASE). */
  counterpartyId: idString,
  date: isoDate,
  price: positiveMoney,
  listPrice: nonNegativeMoney.nullish(),
  /**
   * Defaults: PURCHASE -> NONE (FULL when `sellerIsVatBusiness`); SALE / CONSIGNMENT_SALE ->
   * MARGIN, forced to FULL when the cycle's purchase was from a VAT-registered business.
   */
  vatMode: VatMode.optional(),
  /** VAT percent snapshot; defaults to `Settings.vatRate`. */
  vatRate: percent.optional(),
  /** PURCHASE: seller deducted input VAT -> resale carries full VAT. */
  sellerIsVatBusiness: z.boolean().default(false),
  warrantyText: optionalText(5000),
  /** Buyer countersigned the disclosure form; required before a SALE can be COMPLETED. */
  disclosureSignedAt: isoDateTime.nullish(),
  notes: optionalText(5000),
});

/**
 * `POST /deals` (status DRAFT).
 * - PURCHASE: `vehicleId` or inline `vehicle` (upsert by plate) -> opens an OWNED cycle on completion.
 * - SALE: `vehicleId` (needs an open OWNED cycle), optional `tradeIn`.
 * - CONSIGNMENT_SALE: `vehicleId` (needs an open CONSIGNED cycle).
 */
export const DealCreateSchema = DealFieldsSchema.extend({
  type: DealType,
  vehicleId: idString.optional(),
  vehicle: DealVehicleSchema.optional(),
  /** Inventory cycle; resolved server-side to the vehicle's open cycle when omitted. */
  cycleId: idString.optional(),
  tradeIn: TradeInSchema.optional(),
}).superRefine((v, ctx) => {
  if (v.tradeIn && v.type !== 'SALE') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['tradeIn'], message: msg.tradeInSaleOnly });
  }
  if (v.type === 'PURCHASE') {
    if ((v.vehicleId === undefined) === (v.vehicle === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vehicleId'],
        message: msg.vehicleRequired,
      });
    }
  } else if (!v.vehicleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vehicleId'],
      message: msg.vehicleRequired,
    });
  }
  if (v.tradeIn && v.tradeIn.tradeInValue > v.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tradeIn', 'tradeInValue'],
      message: msg.invalidAmount,
    });
  }
});
export type DealCreate = z.infer<typeof DealCreateSchema>;
export type DealCreateInput = z.input<typeof DealCreateSchema>;

/** `PATCH /deals/:id` (DRAFT / PENDING deals; type, vehicle and trade-in are fixed). */
export const DealUpdateSchema = DealFieldsSchema.extend({
  status: DealStatus.extract(['DRAFT', 'PENDING']),
}).partial();
export type DealUpdate = z.infer<typeof DealUpdateSchema>;
export type DealUpdateInput = z.input<typeof DealUpdateSchema>;

/** `GET /deals?type&status&from&to` */
export const DealQuerySchema = pagination.extend({
  /** Matches deal number, plate, counterparty name / phone. */
  q: querySearch.optional(),
  type: queryList(DealType).optional(),
  status: queryList(DealStatus).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  vehicleId: idString.optional(),
  counterpartyId: idString.optional(),
  /** Completed sales past `transferDueAt` whose transfer is not DONE. */
  transferOverdue: queryBool.optional(),
});
export type DealQuery = z.infer<typeof DealQuerySchema>;

/** `POST /deals/:id/payments` (`DELETE /deal-payments/:id` removes one). */
export const DealPaymentCreateSchema = z.object({
  /** IN = money received (sale), OUT = money paid (purchase, consignor payout). */
  direction: Direction,
  /** Payer / payee; defaults to the deal counterparty (or the consignor for payouts). */
  contactId: idString.nullish(),
  date: isoDate,
  amount: positiveMoney,
  method: PaymentMethod.exclude(['OFFSET']),
  reference: optionalText(100),
  notes: optionalText(1000),
});
export type DealPaymentCreate = z.infer<typeof DealPaymentCreateSchema>;
export type DealPaymentCreateInput = z.input<typeof DealPaymentCreateSchema>;

/** `PATCH /deals/:id/transfer`: ownership-transfer progress of a sale. */
export const DealTransferUpdateSchema = z.object({
  transferStatus: TransferStatus.optional(),
  /** Partial updates are merged into the stored checklist. */
  transferChecklist: TransferChecklistSchema.partial().optional(),
  transferredAt: optionalIsoDate,
});
export type DealTransferUpdate = z.infer<typeof DealTransferUpdateSchema>;
export type DealTransferUpdateInput = z.input<typeof DealTransferUpdateSchema>;

/**
 * `POST /deals/:id/complete`. SALE needs `disclosureSignedAt` (stored or given here) and no open
 * lease segment on the car unless `force`. Completion closes/opens cycles and sets
 * `transferDueAt = workingDaysAfter(date, 6)`.
 */
export const DealCompleteSchema = z.object({
  disclosureSignedAt: isoDateTime.optional(),
  /** Allow completing a sale while the car still has an open lease segment. */
  force: z.boolean().default(false),
});
export type DealComplete = z.infer<typeof DealCompleteSchema>;

/** `POST /deals/:id/cancel` */
export const DealCancelSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type DealCancel = z.infer<typeof DealCancelSchema>;
