import type {
  CommissionMode,
  CycleKind,
  DealStatus,
  DealType,
  Direction,
  Fuel,
  Gearbox,
  PaymentMethod,
  SortOrder,
  TransferChecklistKey,
  TransferStatus,
  VatMode,
  VehicleStatus,
} from '@renawi/shared';
import type { NamedRef } from '../vehicles/types';

/** Car reference on deal lists and the deal page. */
export interface DealVehicleRef {
  id: string;
  plateNo: string;
  make: string;
  model: string;
  year?: number | null;
  isTaxi?: boolean;
  /** Current vehicle status (deal payloads), e.g. LEASED blocks completing a sale. */
  status?: VehicleStatus;
}

/**
 * `Deal.transferChecklist` as returned by the API: the boolean items that apply to the car
 * (`taxiLicenseDetached` only for taxis) plus the optional fee / filed date / notes.
 */
export type TransferChecklistValue = Partial<Record<TransferChecklistKey, boolean>> & {
  transferFee?: number | null;
  filedAt?: string | null;
  notes?: string | null;
};

/** Deal columns (dates `YYYY-MM-DD`, instants ISO, money as numbers). */
export interface Deal {
  id: string;
  dealNo: number;
  type: DealType;
  status: DealStatus;
  vehicleId: string;
  cycleId: string | null;
  counterpartyId: string;
  date: string;
  price: number;
  listPrice: number | null;
  vatMode: VatMode;
  vatRate: number;
  sellerIsVatBusiness: boolean;
  isTradeIn: boolean;
  tradeInDealId: string | null;
  commissionAmount: number | null;
  payoutAmount: number | null;
  warrantyText: string | null;
  /** Instant the buyer countersigned the disclosure form. */
  disclosureSignedAt: string | null;
  transferStatus: TransferStatus;
  transferChecklist: TransferChecklistValue | null;
  transferDueAt: string | null;
  transferredAt: string | null;
  notes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

/** `GET /api/deals` item. */
export interface DealListItem extends Deal {
  vehicle: DealVehicleRef;
  counterparty: NamedRef;
  /** Money received (IN payments, trade-in included). */
  paidIn: number;
  /** Money paid out (OUT payments). */
  paidOut: number;
  /** What the counterparty still owes (sale) or we still owe (purchase). */
  balanceDue: number;
  /** CONSIGNMENT_SALE: payout still owed to the consignor. */
  payoutDue: number | null;
  tradeInValue: number | null;
  /** `disclosureMissing`, `transferDue`, `transferOverdue`, `unpaid` (unknown codes are shown generically). */
  alerts: string[];
}

/** The inventory cycle a deal belongs to. */
export interface DealCycle {
  id: string;
  kind: CycleKind;
  startedAt: string;
  endedAt: string | null;
  purchasePrice: number | null;
  consignor?: NamedRef | null;
  commissionMode: CommissionMode | null;
  commissionValue: number | null;
  minNetToConsignor: number | null;
}

export interface DealPayment {
  id: string;
  direction: Direction;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  contact?: NamedRef | null;
}

/** VAT of the deal as computed by the API. */
export interface DealVat {
  mode: VatMode;
  rate: number;
  base: number;
  amount: number;
}

/** `GET /api/deals/:id` */
export interface DealDetail extends DealListItem {
  cycle: DealCycle | null;
  /** SALE: the linked trade-in PURCHASE deal. */
  tradeInDeal: {
    id: string;
    dealNo: number;
    vehicle: DealVehicleRef;
    price: number;
    status: DealStatus;
  } | null;
  /** Trade-in PURCHASE: the sale it belongs to. */
  tradeInFor: { id: string; dealNo: number } | null;
  payments: DealPayment[];
  vat: DealVat | null;
  documentCount: number;
}

/** Query of `GET /api/deals`. */
export interface DealListQuery {
  q?: string;
  /** Comma-separated types. */
  type?: string;
  /** Comma-separated statuses. */
  status?: string;
  from?: string;
  to?: string;
  vehicleId?: string;
  counterpartyId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
}

/* ---- Request bodies ------------------------------------------------------------------------ */

/** Inline car of a purchase / trade-in that is not in the system yet. */
export interface DealVehicleCreate {
  plateNo: string;
  vin: string | null;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  color: string | null;
  fuel: Fuel | null;
  gearbox: Gearbox | null;
  hand: number | null;
  isTaxi: boolean;
  currentKm: number | null;
  registrationExpiry: string | null;
}

/** An existing car (`{ id }`) or a new one (`{ create }`). */
export type DealVehicleChoice = { id: string } | { create: DealVehicleCreate };

export interface PurchaseCreateBody {
  type: 'PURCHASE';
  vehicle: DealVehicleChoice;
  counterpartyId: string;
  date: string;
  price: number;
  listPrice: number | null;
  sellerIsVatBusiness: boolean;
  notes: string | null;
}

export interface TradeInBody {
  vehicle: DealVehicleChoice;
  value: number;
  listPrice: number | null;
}

export interface SaleCreateBody {
  type: 'SALE';
  vehicleId: string;
  counterpartyId: string;
  date: string;
  price: number;
  listPrice: number | null;
  vatMode: 'MARGIN' | 'FULL';
  warrantyText: string | null;
  tradeIn?: TradeInBody;
  notes: string | null;
}

export interface ConsignmentSaleCreateBody {
  type: 'CONSIGNMENT_SALE';
  vehicleId: string;
  counterpartyId: string;
  date: string;
  price: number;
  listPrice: number | null;
  warrantyText: string | null;
  notes: string | null;
}

/** `POST /api/deals` */
export type DealCreateBody = PurchaseCreateBody | SaleCreateBody | ConsignmentSaleCreateBody;

/** `PATCH /api/deals/:id` (DRAFT / PENDING: terms; COMPLETED: warranty and notes only). */
export interface DealUpdateBody {
  date?: string;
  price?: number;
  listPrice?: number | null;
  counterpartyId?: string;
  vatMode?: VatMode;
  warrantyText?: string | null;
  notes?: string | null;
  sellerIsVatBusiness?: boolean;
}

/** `POST /api/deals/:id/payments` */
export interface DealPaymentBody {
  direction: Direction;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  contactId?: string | null;
}

/** `PATCH /api/deals/:id/transfer` */
export interface DealTransferBody {
  /** Changed items only; the API merges them into the stored checklist. */
  checklist?: Partial<Record<TransferChecklistKey, boolean>>;
  transferStatus?: TransferStatus;
  transferredAt?: string | null;
}
