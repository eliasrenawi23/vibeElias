import { ChargeKind, LeaseContract, Prisma } from '@prisma/client';
import type { LeaseAlert } from '@renawi/shared';
import { CONTACT_NAME_SELECT, NamedRef } from '../common/refs';
import type { BalanceView } from '../ledger/ledger-views';

export const SEGMENT_INCLUDE = {
  taxiLicense: { select: { id: true, licenseNo: true } },
  vehicle: { select: { id: true, plateNo: true } },
} satisfies Prisma.LeaseSegmentInclude;
export type SegmentWithRefs = Prisma.LeaseSegmentGetPayload<{ include: typeof SEGMENT_INCLUDE }>;

export const LEASE_LIST_INCLUDE = {
  driver: { select: { id: true, contact: { select: CONTACT_NAME_SELECT } } },
  segments: {
    where: { endDate: null },
    orderBy: { startDate: 'desc' },
    take: 1,
    include: SEGMENT_INCLUDE,
  },
} satisfies Prisma.LeaseContractInclude;
export type LeaseWithRefs = Prisma.LeaseContractGetPayload<{ include: typeof LEASE_LIST_INCLUDE }>;

/** The open segment of a contract. */
export interface SegmentRef {
  id: string;
  taxiLicense: { id: string; licenseNo: string };
  vehicle: { id: string; plateNo: string } | null;
  monthlyRent: Prisma.Decimal;
  startDate: Date;
}

/** A segment in the contract history. */
export interface SegmentView extends SegmentRef {
  endDate: Date | null;
  reason: string | null;
}

/** `GET /leases` item. `balance` is the driver-level balance (it carries across contracts). */
export interface LeaseListItem extends LeaseContract {
  driver: NamedRef;
  currentSegment: SegmentRef | null;
  balance: Pick<BalanceView, 'balance' | 'depositHeld'>;
  alerts: LeaseAlert[];
}

export interface OpenCharge {
  id: string;
  chargeKind: ChargeKind | null;
  rentPeriod: string | null;
  date: Date;
  dueDate: Date | null;
  amount: Prisma.Decimal;
  remaining: Prisma.Decimal;
  description: string | null;
}

/** `GET /leases/:id` (also returned by every lease action). */
export interface LeaseDetail extends Omit<LeaseListItem, 'balance'> {
  /** Newest first. */
  segments: SegmentView[];
  balance: BalanceView;
  /** This contract's charges with an open remainder, oldest due first. */
  openCharges: OpenCharge[];
  /** The driver's latest payment. */
  lastPayment: { date: Date; amount: Prisma.Decimal } | null;
  renewedFrom: { id: string; contractNo: number } | null;
  renewedTo: { id: string; contractNo: number } | null;
  documentCount: number;
}

export function segmentRef(s: SegmentWithRefs): SegmentRef {
  return {
    id: s.id,
    taxiLicense: s.taxiLicense,
    vehicle: s.vehicle ?? null,
    monthlyRent: s.monthlyRent,
    startDate: s.startDate,
  };
}

export function segmentView(s: SegmentWithRefs): SegmentView {
  return { ...segmentRef(s), endDate: s.endDate, reason: s.reason };
}
