import {
  CycleKind,
  ExpenseCategory,
  InsurancePolicy,
  InventoryCycle,
  OdometerLog,
  PaidBy,
  Prisma,
  Vehicle,
} from '@prisma/client';
import { contactDisplayName, ExpenseCategory as ExpenseCategoryEnum, type VehicleAlert } from '@renawi/shared';
import { CONTACT_NAME_SELECT, contactRef, NamedRef } from '../common/refs';

/** Relations loaded for every vehicle list item. */
export const VEHICLE_LIST_INCLUDE = {
  registeredLicense: { select: { id: true, licenseNo: true } },
  ownerDriver: { select: { id: true, contact: { select: CONTACT_NAME_SELECT } } },
  cycles: {
    where: { endedAt: null },
    orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    select: { id: true, kind: true, startedAt: true },
  },
} satisfies Prisma.VehicleInclude;

export type VehicleWithRefs = Prisma.VehicleGetPayload<{ include: typeof VEHICLE_LIST_INCLUDE }>;

export interface OpenCycleRef {
  id: string;
  kind: CycleKind;
  startedAt: Date;
}

/** `GET /vehicles` item. */
export interface VehicleListItem extends Vehicle {
  registeredLicense: { id: string; licenseNo: string } | null;
  ownerDriver: NamedRef | null;
  openCycle: OpenCycleRef | null;
  alerts: VehicleAlert[];
}

/** Inventory cycle with its consignor and expense totals. */
export interface CycleView extends InventoryCycle {
  consignor: NamedRef | null;
  /** All expenses linked to the cycle (whoever paid). */
  expenseTotal: Prisma.Decimal;
  /** Expenses of the cycle paid by the business. */
  expensePaidByUs: Prisma.Decimal;
}

export interface ExpenseSummary {
  /** Sum of all matching expenses (whoever paid). */
  total: Prisma.Decimal;
  /** Sum of the expenses paid by the business (paidBy US). */
  paidByUs: Prisma.Decimal;
  count: number;
  /** Per category, in `ExpenseCategory` order; only categories with expenses. */
  byCategory: { category: ExpenseCategory; total: Prisma.Decimal }[];
}

/** `GET /vehicles/:id`. */
export interface VehicleDetail extends VehicleListItem {
  /** All cycles, newest first. */
  cycles: CycleView[];
  /** Policies, newest first. */
  insurance: InsurancePolicy[];
  /** Last 20 readings, newest first. */
  odometer: OdometerLog[];
  /** Expenses of the open cycle (zeros when there is none). */
  expenseSummary: ExpenseSummary & { cycleId: string | null };
  documentCount: number;
}

/** Splits the loaded relations off a vehicle row into the list-item shape (alerts added later). */
export function toListItemBase(row: VehicleWithRefs): Omit<VehicleListItem, 'alerts'> {
  const { registeredLicense, ownerDriver, cycles, ...vehicle } = row;
  return {
    ...vehicle,
    registeredLicense: registeredLicense ?? null,
    ownerDriver: ownerDriver
      ? { id: ownerDriver.id, name: contactDisplayName(ownerDriver.contact) }
      : null,
    openCycle: cycles[0] ?? null,
  };
}

const ZERO = new Prisma.Decimal(0);

/** Totals of a set of expenses. */
export function summarizeExpenses(
  rows: readonly { category: ExpenseCategory; amount: Prisma.Decimal; paidBy: PaidBy }[],
): ExpenseSummary {
  let total = ZERO;
  let paidByUs = ZERO;
  const perCategory = new Map<ExpenseCategory, Prisma.Decimal>();
  for (const r of rows) {
    total = total.plus(r.amount);
    if (r.paidBy === 'US') paidByUs = paidByUs.plus(r.amount);
    perCategory.set(r.category, (perCategory.get(r.category) ?? ZERO).plus(r.amount));
  }
  const byCategory = ExpenseCategoryEnum.options
    .filter((c) => perCategory.has(c))
    .map((category) => ({ category, total: perCategory.get(category) as Prisma.Decimal }));
  return { total, paidByUs, count: rows.length, byCategory };
}

export type CycleWithConsignor = Prisma.InventoryCycleGetPayload<{
  include: { consignor: { select: typeof CONTACT_NAME_SELECT } };
}>;

/** Cycles + per-cycle totals from a `groupBy(['cycleId', 'paidBy'])` result. */
export function toCycleViews(
  cycles: readonly CycleWithConsignor[],
  sums: readonly { cycleId: string | null; paidBy: PaidBy; _sum: { amount: Prisma.Decimal | null } }[],
): CycleView[] {
  return cycles.map(({ consignor, ...cycle }) => {
    let expenseTotal = ZERO;
    let expensePaidByUs = ZERO;
    for (const s of sums) {
      if (s.cycleId !== cycle.id) continue;
      const amount = s._sum.amount ?? ZERO;
      expenseTotal = expenseTotal.plus(amount);
      if (s.paidBy === 'US') expensePaidByUs = expensePaidByUs.plus(amount);
    }
    return { ...cycle, consignor: contactRef(consignor), expenseTotal, expensePaidByUs };
  });
}
