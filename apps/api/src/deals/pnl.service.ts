import { Injectable } from '@nestjs/common';
import { CycleEndReason, CycleKind, Prisma } from '@prisma/client';
import { round2, sumMoney } from '@renawi/shared';
import { readVatRate } from '../common/business-settings';
import { dbDate, isoOf } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { cyclePnl, CyclePnl } from './pnl';

/** `GET /vehicles/:id/pnl` cycle row. */
export interface CyclePnlView extends CyclePnl {
  id: string;
  kind: CycleKind;
  startedAt: Date;
  endedAt: Date | null;
  endReason: CycleEndReason | null;
  open: boolean;
}

export interface VehiclePnl {
  /** Cycles newest first (cancelled cycles left out). */
  cycles: CyclePnlView[];
  /** Sums over the listed cycles (including unrealised ones). */
  totals: { revenue: number; costs: number; profit: number };
}

export interface LicensePnl {
  acquisitionPrice: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  acquiredAt: Date | null;
  soldAt: Date | null;
  /** Per calendar year of the entry date, oldest first. */
  byYear: { year: number; rentIncome: number; otherIncome: number }[];
  totalIncome: number;
  /** `totalIncome + salePrice - acquisitionPrice` (missing prices count as 0). */
  net: number;
}

const CYCLE_PNL_INCLUDE = {
  vehicle: { select: { listingPrice: true } },
  purchaseDeal: { select: { price: true, status: true, vatMode: true, vatRate: true } },
  saleDeal: {
    select: { price: true, status: true, vatMode: true, vatRate: true, commissionAmount: true },
  },
  expenses: {
    select: {
      amount: true,
      paidBy: true,
      vatIncluded: true,
      vatReclaimable: true,
      rebilledEntry: { select: { amount: true, voidedAt: true } },
    },
  },
} satisfies Prisma.InventoryCycleInclude;
type CycleRow = Prisma.InventoryCycleGetPayload<{ include: typeof CYCLE_PNL_INCLUDE }>;

/** Cycles that count for P&L: everything but CANCELLED (a cancelled purchase never happened). */
export const NOT_CANCELLED: Prisma.InventoryCycleWhereInput = {
  OR: [{ endReason: null }, { endReason: { not: 'CANCELLED' } }],
};

interface IncomeEntry {
  vehicleId: string | null;
  type: 'CHARGE' | 'CREDIT';
  amount: Prisma.Decimal;
  date: Date;
}

/** Vehicle and taxi-licence profit & loss from cycles, deals, expenses and ledger income. */
@Injectable()
export class PnlService {
  constructor(private readonly prisma: PrismaService) {}

  async vehiclePnl(vehicleId: string): Promise<VehiclePnl> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle) throw AppException.notFound();
    const cycles = await this.cyclesPnl({ vehicleId, ...NOT_CANCELLED }, [
      { startedAt: 'desc' },
      { createdAt: 'desc' },
    ]);
    return {
      cycles,
      totals: {
        revenue: sumMoney(cycles.map((c) => c.revenue.total)),
        costs: sumMoney(cycles.map((c) => c.costs.total)),
        profit: sumMoney(cycles.map((c) => c.profit)),
      },
    };
  }

  /** Profit of the (non-cancelled) cycles that ended within `[from, to]` (dashboard KPI). */
  async profitOfCyclesClosedBetween(from: string, to: string): Promise<number> {
    const cycles = await this.cyclesClosedBetween(from, to);
    return sumMoney(cycles.map((c) => c.profit));
  }

  /** P&L of the (non-cancelled) cycles that ended within `[from, to]`, oldest end first. */
  cyclesClosedBetween(from: string, to: string): Promise<CyclePnlView[]> {
    return this.cyclesPnl({ endedAt: { gte: dbDate(from), lte: dbDate(to) }, ...NOT_CANCELLED }, [
      { endedAt: 'asc' },
      { startedAt: 'asc' },
    ]);
  }

  /**
   * Licence P&L from its non-void ledger entries: RENT charges minus credits = rent income,
   * other charges = other income (expenses passed on to drivers are cost recoveries and do not
   * count).
   */
  async licensePnl(id: string): Promise<LicensePnl> {
    const license = await this.prisma.taxiLicense.findUnique({
      where: { id },
      select: { acquisitionPrice: true, salePrice: true, acquiredAt: true, soldAt: true },
    });
    if (!license) throw AppException.notFound();
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        taxiLicenseId: id,
        voidedAt: null,
        type: { in: ['CHARGE', 'CREDIT'] },
        rebilledExpense: { is: null },
      },
      select: { type: true, chargeKind: true, amount: true, date: true },
    });
    const years = new Map<number, { rent: Prisma.Decimal[]; other: Prisma.Decimal[] }>();
    for (const e of entries) {
      const year = e.date.getUTCFullYear();
      const bucket = years.get(year) ?? { rent: [], other: [] };
      if (e.type === 'CREDIT') bucket.rent.push(e.amount.negated());
      else if (e.chargeKind === 'RENT') bucket.rent.push(e.amount);
      else bucket.other.push(e.amount);
      years.set(year, bucket);
    }
    const byYear = [...years.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, b]) => ({ year, rentIncome: sumMoney(b.rent), otherIncome: sumMoney(b.other) }));
    const totalIncome = sumMoney(byYear.flatMap((y) => [y.rentIncome, y.otherIncome]));
    return {
      ...license,
      byYear,
      totalIncome,
      net: sumMoney([totalIncome, license.salePrice ?? 0, -round2(license.acquisitionPrice ?? 0)]),
    };
  }

  /** P&L rows of the matching cycles (also used by the reports). */
  async cyclesPnl(
    where: Prisma.InventoryCycleWhereInput,
    orderBy: Prisma.InventoryCycleOrderByWithRelationInput[],
  ): Promise<CyclePnlView[]> {
    const cycles = await this.prisma.inventoryCycle.findMany({
      where,
      orderBy,
      include: CYCLE_PNL_INCLUDE,
    });
    if (cycles.length === 0) return [];
    const vatRate = await readVatRate(this.prisma);
    const vehicleIds = [...new Set(cycles.map((c) => c.vehicleId))];
    // Lease income attributed to the cars; charges created by rebilling an expense are counted
    // as `rebilled` on the expense's cycle instead.
    const income: IncomeEntry[] = (await this.prisma.ledgerEntry.findMany({
      where: {
        vehicleId: { in: vehicleIds },
        voidedAt: null,
        type: { in: ['CHARGE', 'CREDIT'] },
        rebilledExpense: { is: null },
      },
      select: { vehicleId: true, type: true, amount: true, date: true },
    })) as IncomeEntry[];
    return cycles.map((c) => this.toView(c, income, vatRate));
  }

  private toView(c: CycleRow, income: readonly IncomeEntry[], vatRate: Prisma.Decimal) {
    const start = isoOf(c.startedAt);
    const end = c.endedAt ? isoOf(c.endedAt) : null;
    const inCycle = income.filter((e) => {
      if (e.vehicleId !== c.vehicleId) return false;
      const d = isoOf(e.date);
      return d >= start && (end === null || d <= end);
    });
    const leaseIncome = sumMoney(
      inCycle.map((e) => (e.type === 'CREDIT' ? e.amount.negated() : e.amount)),
    );
    const rebilled = sumMoney(
      c.expenses
        .map((x) => x.rebilledEntry)
        .filter((r): r is { amount: Prisma.Decimal; voidedAt: null } => !!r && !r.voidedAt)
        .map((r) => r.amount),
    );
    const open = c.endedAt === null;
    const purchase =
      c.kind === 'OWNED' && c.purchaseDeal && c.purchaseDeal.status !== 'CANCELLED'
        ? c.purchaseDeal
        : null;
    const sale = c.saleDeal && c.saleDeal.status === 'COMPLETED' ? c.saleDeal : null;
    const pnl = cyclePnl({
      kind: c.kind,
      open,
      purchase,
      sale,
      listingPrice: open ? (c.vehicle.listingPrice ?? c.askingPrice) : c.askingPrice,
      consignment: c.kind === 'CONSIGNED' ? c : null,
      expenses: c.expenses,
      vatRate,
      leaseIncome,
      rebilled,
    });
    return {
      id: c.id,
      kind: c.kind,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      endReason: c.endReason,
      open,
      ...pnl,
    };
  }
}
