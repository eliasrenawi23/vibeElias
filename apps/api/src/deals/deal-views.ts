import { Deal, DealPayment, Prisma } from '@prisma/client';
import type { DealAlert } from '@renawi/shared';
import { CONTACT_NAME_SELECT, NamedRef } from '../common/refs';
import { DealMoney, DealVat, TransferChecklistView } from './deal-rules';

/** Vehicle reference on deals. */
export const DEAL_VEHICLE_SELECT = {
  id: true,
  plateNo: true,
  make: true,
  model: true,
  year: true,
  isTaxi: true,
  status: true,
} satisfies Prisma.VehicleSelect;
export type DealVehicleRef = Prisma.VehicleGetPayload<{ select: typeof DEAL_VEHICLE_SELECT }>;

/** Relations loaded for list items. */
export const DEAL_LIST_INCLUDE = {
  vehicle: { select: DEAL_VEHICLE_SELECT },
  counterparty: { select: CONTACT_NAME_SELECT },
  payments: { select: { direction: true, method: true, amount: true } },
} satisfies Prisma.DealInclude;
export type DealListRow = Prisma.DealGetPayload<{ include: typeof DEAL_LIST_INCLUDE }>;

/** The cycle's purchase deal fields needed for VAT and P&L. */
export const PURCHASE_REF_SELECT = {
  id: true,
  price: true,
  status: true,
  vatMode: true,
  vatRate: true,
  sellerIsVatBusiness: true,
} satisfies Prisma.DealSelect;

/** Relations loaded for `GET /deals/:id`. */
export const DEAL_DETAIL_INCLUDE = {
  vehicle: { select: DEAL_VEHICLE_SELECT },
  counterparty: { select: CONTACT_NAME_SELECT },
  payments: {
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    include: { contact: { select: CONTACT_NAME_SELECT } },
  },
  cycle: {
    include: {
      consignor: { select: CONTACT_NAME_SELECT },
      purchaseDeal: { select: PURCHASE_REF_SELECT },
    },
  },
  tradeInDeal: {
    select: {
      id: true,
      dealNo: true,
      price: true,
      status: true,
      vehicle: { select: { id: true, plateNo: true, make: true, model: true } },
    },
  },
  tradeInFor: { select: { id: true, dealNo: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.DealInclude;
export type DealDetailRow = Prisma.DealGetPayload<{ include: typeof DEAL_DETAIL_INCLUDE }>;

/** `GET /deals` item. */
export interface DealListItem extends Omit<Deal, 'transferChecklist'>, DealMoney {
  vehicle: DealVehicleRef;
  counterparty: NamedRef;
  /** Stored checklist merged with the defaults (`taxiLicenseDetached` for taxis only). */
  transferChecklist: TransferChecklistView;
  alerts: DealAlert[];
}

/** `cycle` of `GET /deals/:id`. */
export interface DealCycleView {
  id: string;
  kind: 'OWNED' | 'CONSIGNED';
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  /** Price of the cycle's (non-cancelled) purchase deal; null for consigned / unknown. */
  purchasePrice: Prisma.Decimal | null;
  askingPrice: Prisma.Decimal | null;
  consignor: NamedRef | null;
  commissionMode: string | null;
  commissionValue: Prisma.Decimal | null;
  minNetToConsignor: Prisma.Decimal | null;
}

/** `GET /deals/:id` (also returned by every deal action). */
export interface DealDetail extends DealListItem {
  cycle: DealCycleView | null;
  tradeInDeal: {
    id: string;
    dealNo: number;
    vehicle: { id: string; plateNo: string; make: string; model: string };
    price: Prisma.Decimal;
    status: string;
  } | null;
  tradeInFor: { id: string; dealNo: number } | null;
  payments: (DealPayment & { contact: NamedRef | null })[];
  vat: DealVat;
  documentCount: number;
}
