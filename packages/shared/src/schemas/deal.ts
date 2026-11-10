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

/* ------------------------------------------------------------------------------------------ */
/* API request bodies (milestone 4)                                                           */
/* ------------------------------------------------------------------------------------------ */

/**
 * Vehicle fields of a car entered through a purchase or trade-in. Status and ownership are set
 * by the deal (IN_STOCK / OWNED); `isTaxi` defaults to false for a new car and is kept on a
 * relinked one unless sent.
 */
export const DealVehicleCreateSchema = VehicleBaseSchema.omit({
  status: true,
  ownership: true,
  ownerDriverId: true,
}).extend({ isTaxi: z.boolean().optional() });
export type DealVehicleCreate = z.infer<typeof DealVehicleCreateSchema>;

/**
 * `{ id }` of a vehicle already in the system, or `{ create }` with its details. `create` upserts
 * by plate: an existing plate without an open cycle is relinked (buy-back -> a new cycle).
 */
export const DealVehicleInputSchema = z
  .object({
    id: idString.optional(),
    create: DealVehicleCreateSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.id === undefined) === (v.create === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: msg.vehicleRequired });
    }
  });
export type DealVehicleInput = z.infer<typeof DealVehicleInputSchema>;

const dealRequestFields = {
  /** Seller (PURCHASE) or buyer (SALE / CONSIGNMENT_SALE). */
  counterpartyId: idString,
  date: isoDate,
  price: positiveMoney,
  /** Price-guide reference (Levi Yitzhak). */
  listPrice: nonNegativeMoney.nullish(),
  notes: optionalText(5000),
};

/** VAT modes a SALE may use (MARGIN by default; FULL is forced by a VAT-business purchase). */
export const SaleVatMode = VatMode.exclude(['NONE']);
export type SaleVatMode = z.infer<typeof SaleVatMode>;

/**
 * PURCHASE: opens an OWNED cycle (or attaches to an open OWNED cycle that has no purchase deal
 * yet), vehicle IN_STOCK / OWNED, `vatMode = sellerIsVatBusiness ? FULL : NONE`, status DRAFT.
 */
export const DealPurchaseCreateSchema = z.object({
  type: z.literal('PURCHASE'),
  vehicle: DealVehicleInputSchema,
  ...dealRequestFields,
  /** The seller is a VAT-registered business that deducted input VAT (resale carries full VAT). */
  sellerIsVatBusiness: z.boolean().default(false),
});
export type DealPurchaseCreate = z.infer<typeof DealPurchaseCreateSchema>;

/** Trade-in block of a SALE: a linked PURCHASE (`isTradeIn`, status PENDING) from the buyer. */
export const DealTradeInInputSchema = z.object({
  vehicle: DealVehicleInputSchema,
  /** Agreed trade-in value = the purchase price; recorded as TRADE_IN payments on both deals. */
  value: positiveMoney,
  /** Price-guide reference (Levi Yitzhak). */
  listPrice: nonNegativeMoney.nullish(),
  /** The buyer is a VAT-registered business (the trade-in purchase then carries full VAT). */
  sellerIsVatBusiness: z.boolean().default(false),
  notes: optionalText(2000),
});
export type DealTradeInInput = z.infer<typeof DealTradeInInputSchema>;

/**
 * SALE: needs an open OWNED cycle, no open lease segment and no other DRAFT / PENDING sale on
 * the car; vehicle RESERVED, status DRAFT. `vatMode` defaults to MARGIN (forced FULL when the
 * cycle purchase was from a VAT-registered business).
 */
export const DealSaleCreateSchema = z.object({
  type: z.literal('SALE'),
  vehicleId: idString,
  ...dealRequestFields,
  vatMode: SaleVatMode.optional(),
  warrantyText: optionalText(5000),
  tradeIn: DealTradeInInputSchema.optional(),
});
export type DealSaleCreate = z.infer<typeof DealSaleCreateSchema>;

/**
 * CONSIGNMENT_SALE: needs an open CONSIGNED cycle; commission from the cycle rule, payout =
 * price - commission, `vatMode` NONE (VAT is due on our commission at business level).
 */
export const DealConsignmentSaleCreateSchema = z.object({
  type: z.literal('CONSIGNMENT_SALE'),
  vehicleId: idString,
  ...dealRequestFields,
  warrantyText: optionalText(5000),
});
export type DealConsignmentSaleCreate = z.infer<typeof DealConsignmentSaleCreateSchema>;

/** `POST /deals` (discriminated by `type`). */
export const DealCreateRequestSchema = z
  .discriminatedUnion('type', [
    DealPurchaseCreateSchema,
    DealSaleCreateSchema,
    DealConsignmentSaleCreateSchema,
  ])
  .superRefine((v, ctx) => {
    if (v.type === 'SALE' && v.tradeIn && v.tradeIn.value > v.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tradeIn', 'value'],
        message: msg.invalidAmount,
      });
    }
  });
export type DealCreateRequest = z.infer<typeof DealCreateRequestSchema>;
export type DealCreateRequestInput = z.input<typeof DealCreateRequestSchema>;

/**
 * `PATCH /deals/:id`. DRAFT / PENDING: every field (within the VAT rules of the deal type; a
 * trade-in purchase keeps its price, date and counterparty). COMPLETED: only `notes` and
 * `warrantyText`. CANCELLED: nothing. Other changes -> 409 `errors.dealNotEditable` with one
 * entry per field.
 */
export const DealUpdateRequestSchema = z.object({
  /** DRAFT <-> PENDING (completion and cancellation have their own actions). */
  status: DealStatus.extract(['DRAFT', 'PENDING']).optional(),
  counterpartyId: idString.optional(),
  date: isoDate.optional(),
  price: positiveMoney.optional(),
  listPrice: nonNegativeMoney.nullish(),
  vatMode: VatMode.optional(),
  /** PURCHASE only. */
  sellerIsVatBusiness: z.boolean().optional(),
  warrantyText: optionalText(5000),
  notes: optionalText(5000),
});
export type DealUpdateRequest = z.infer<typeof DealUpdateRequestSchema>;
export type DealUpdateRequestInput = z.input<typeof DealUpdateRequestSchema>;

/** `POST /deals/:id/disclosure`: the buyer countersigned the disclosure form (null clears it). */
export const DealDisclosureSchema = z.object({
  signedAt: isoDateTime.nullable(),
});
export type DealDisclosure = z.infer<typeof DealDisclosureSchema>;

/** `POST /deals/:id/complete` (body optional). `date` defaults to the deal date. */
export const DealCompleteRequestSchema = z.object({
  date: isoDate.optional(),
});
export type DealCompleteRequest = z.infer<typeof DealCompleteRequestSchema>;

/** `POST /deals/:id/cancel` (body optional). */
export const DealCancelRequestSchema = z.object({
  reason: optionalText(1000),
});
export type DealCancelRequest = z.infer<typeof DealCancelRequestSchema>;

/** Methods of manual deal payments (TRADE_IN rows come from the trade-in; OFFSET is ledger-only). */
export const DealPaymentMethod = PaymentMethod.exclude(['TRADE_IN', 'OFFSET']);
export type DealPaymentMethod = z.infer<typeof DealPaymentMethod>;

/** `POST /deals/:id/payments` (`DELETE /deal-payments/:id` removes a manual payment). */
export const DealPaymentRequestSchema = z.object({
  /** IN = money received, OUT = money paid (purchase price, consignor payout, refund). */
  direction: Direction,
  date: isoDate,
  amount: positiveMoney,
  method: DealPaymentMethod,
  reference: optionalText(100),
  notes: optionalText(1000),
  /** Payer / payee; defaults to the counterparty (the consignor for consignment payouts). */
  contactId: idString.nullish(),
});
export type DealPaymentRequest = z.infer<typeof DealPaymentRequestSchema>;
export type DealPaymentRequestInput = z.input<typeof DealPaymentRequestSchema>;

/**
 * `PATCH /deals/:id/transfer`: merges the checklist; the status rolls up (any item ticked ->
 * IN_PROGRESS, every applicable item -> DONE with `transferredAt` defaulting to today). An
 * explicit `transferStatus` may lower the status to what the checklist implies; DONE or a
 * `transferredAt` date always means DONE.
 */
export const DealTransferRequestSchema = z.object({
  checklist: TransferChecklistSchema.partial().optional(),
  transferStatus: TransferStatus.optional(),
  transferredAt: optionalIsoDate,
});
export type DealTransferRequest = z.infer<typeof DealTransferRequestSchema>;
export type DealTransferRequestInput = z.input<typeof DealTransferRequestSchema>;

/** `GET /deals/summary`: the list filters minus status and paging. */
export const DealSummaryQuerySchema = DealQuerySchema.omit({
  status: true,
  page: true,
  pageSize: true,
  sort: true,
  order: true,
});
export type DealSummaryQuery = z.infer<typeof DealSummaryQuerySchema>;
