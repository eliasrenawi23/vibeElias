import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  contactDisplayName,
  formatPhone,
  INVENTORY_AGE_BUCKETS,
  inventoryAgeBucket,
  round2,
  sumMoney,
  vatFromGross,
  type ExpenseReportGroupBy,
  type ExpensesReportQuery,
  type FinesReportQuery,
  type InventoryAgeingQuery,
  type LeaseIncomeReportQuery,
  type ProfitReportQuery,
  type ReceivablesReportQuery,
  type ReportPeriodGroupBy,
  type ReportResult,
  type ReportRow,
  type TradeBookQuery,
} from '@renawi/shared';
import { z } from 'zod';
import { readVatRate } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { CONTACT_NAME_SELECT } from '../common/refs';
import { NOT_CANCELLED, PnlService } from '../deals/pnl.service';
import { LedgerService } from '../ledger/ledger.service';
import { isDecimal } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import type { ParamKind } from './report-export';
import {
  aggregateProfit,
  col,
  daysBetween,
  periodKey,
  periodKeys,
  resolveRange,
  totalsOf,
  type ProfitIncome,
  type ProfitPeriod,
} from './report-rules';

/** Parameter display kinds per report (context sheet of the exports). */
export const REPORT_PARAM_KINDS: Readonly<Record<string, Readonly<Record<string, ParamKind>>>> = {
  profit: { from: 'date', to: 'date', groupBy: 'groupBy' },
  'inventory-ageing': { asOf: 'date' },
  receivables: { asOf: 'date' },
  expenses: { from: 'date', to: 'date', groupBy: 'groupBy' },
  'lease-income': { from: 'date', to: 'date', groupBy: 'groupBy' },
  'trade-book': { from: 'date', to: 'date' },
  fines: { from: 'date', to: 'date', status: { enum: 'FineStatus' } },
};

const numeric = z.custom<Prisma.Decimal>((v) => isDecimal(v));
const ReceivableBalanceRow = z.object({
  driverId: z.string(),
  balance: numeric,
  deposit_held: numeric,
});

const VEHICLE_SELECT = { id: true, plateNo: true, make: true, model: true, year: true } as const;

/** `Mazda 3 2019` */
function vehicleName(v: { make: string; model: string; year: number }): string {
  return [v.make, v.model, v.year].filter(Boolean).join(' ');
}

function money(value: Prisma.Decimal | number | null | undefined): number | null {
  return value === null || value === undefined ? null : round2(value);
}

function firstPhone(phones: readonly string[]): string | null {
  const p = phones.find(Boolean);
  return p ? formatPhone(p) : null;
}

/** Data of the reports (`GET /reports/*`); rendering to CSV / XLSX is in `report-export.ts`. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly pnl: PnlService,
    private readonly ledger: LedgerService,
  ) {}

  /* ------------------------------------------------------------------------------------ */
  /* Profit                                                                               */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Profit per period: inventory cycles closed in the period (vehicle P&L rules: sale price or
   * commission, purchase, expenses net of rebills, VAT) + lease income by entry date.
   */
  async profitPeriods(
    from: string,
    to: string,
    groupBy: ReportPeriodGroupBy,
  ): Promise<ProfitPeriod[]> {
    const [cycles, income] = await Promise.all([
      this.pnl.cyclesClosedBetween(from, to),
      this.prisma.ledgerEntry.findMany({
        where: {
          voidedAt: null,
          type: { in: ['CHARGE', 'CREDIT'] },
          rebilledExpense: { is: null },
          date: { gte: dbDate(from), lte: dbDate(to) },
        },
        select: { type: true, amount: true, date: true },
      }),
    ]);
    return aggregateProfit(
      cycles
        .filter((c) => c.endedAt)
        .map((c) => ({
          endedAt: isoOf(c.endedAt as Date),
          sale: c.revenue.sale,
          commission: c.revenue.commission,
          purchase: c.costs.purchase,
          expenses: c.costs.expenses,
          rebilled: c.revenue.rebilled,
          vat: c.costs.vatOnMargin,
        })),
      income.map(
        (e): ProfitIncome => ({
          date: isoOf(e.date),
          type: e.type as ProfitIncome['type'],
          amount: e.amount,
        }),
      ),
      from,
      to,
      groupBy,
    );
  }

  async profit(q: ProfitReportQuery): Promise<ReportResult> {
    const { from, to } = resolveRange(q.from, q.to, this.clock.today());
    const columns = [
      col('period', 'text'),
      col('salesRevenue', 'money'),
      col('purchaseCost', 'money'),
      col('expenses', 'money'),
      col('vatOnMargin', 'money'),
      col('commission', 'money'),
      col('leaseIncome', 'money'),
      col('profit', 'money'),
    ];
    const rows: ReportRow[] = (await this.profitPeriods(from, to, q.groupBy)).map((p) => ({
      ...p,
    }));
    return {
      report: 'profit',
      params: { from, to, groupBy: q.groupBy },
      columns,
      rows,
      totals: totalsOf(columns, rows),
    };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Inventory ageing                                                                     */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Stock on `asOf`: inventory cycles open that day (owned or consigned) whose car was not on
   * a lease segment that day. Oldest stock first.
   */
  async inventoryAgeing(q: InventoryAgeingQuery): Promise<ReportResult> {
    const asOf = q.asOf ?? this.clock.today();
    const day = dbDate(asOf);
    const cycles = await this.prisma.inventoryCycle.findMany({
      where: {
        AND: [
          NOT_CANCELLED,
          { startedAt: { lte: day } },
          { OR: [{ endedAt: null }, { endedAt: { gt: day } }] },
          {
            vehicle: {
              segments: {
                none: { startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] },
              },
            },
          },
        ],
      },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        kind: true,
        startedAt: true,
        askingPrice: true,
        vehicle: { select: { ...VEHICLE_SELECT, listingPrice: true, status: true } },
        purchaseDeal: { select: { price: true, date: true, status: true } },
        expenses: {
          where: { paidBy: 'US', date: { lte: day } },
          select: { amount: true },
        },
      },
    });
    const columns = [
      col('plateNo', 'plate'),
      col('vehicle', 'text'),
      col('ownership', 'enum', 'CycleKind'),
      col('status', 'enum', 'VehicleStatus'),
      col('purchaseDate', 'date'),
      col('purchasePrice', 'money'),
      col('expenses', 'money'),
      col('totalCost', 'money'),
      col('listingPrice', 'money'),
      col('daysInStock', 'int'),
      col('ageBucket', 'text'),
    ];
    const buckets = Object.fromEntries(INVENTORY_AGE_BUCKETS.map((b) => [b, 0])) as Record<
      string,
      number
    >;
    const rows: ReportRow[] = cycles.map((c) => {
      const purchase =
        c.kind === 'OWNED' && c.purchaseDeal && c.purchaseDeal.status !== 'CANCELLED'
          ? c.purchaseDeal
          : null;
      const expenses = sumMoney(c.expenses.map((e) => e.amount));
      const purchasePrice = money(purchase?.price);
      const days = daysBetween(isoOf(c.startedAt), asOf);
      const bucket = inventoryAgeBucket(days);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
      return {
        plateNo: c.vehicle.plateNo,
        vehicle: vehicleName(c.vehicle),
        ownership: c.kind,
        status: c.vehicle.status,
        purchaseDate: isoOf(purchase?.date ?? c.startedAt),
        purchasePrice,
        expenses,
        // Consigned cars cost us only the expenses; owned cars without a purchase: unknown.
        totalCost:
          c.kind === 'CONSIGNED'
            ? expenses
            : purchasePrice === null
              ? null
              : sumMoney([purchasePrice, expenses]),
        listingPrice: money(c.vehicle.listingPrice ?? c.askingPrice),
        daysInStock: days,
        ageBucket: bucket,
      };
    });
    const totals = totalsOf(columns, rows);
    totals.daysInStock = null;
    return {
      report: 'inventory-ageing',
      params: { asOf },
      columns,
      rows,
      totals,
      summary: { buckets },
    };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Receivables                                                                          */
  /* ------------------------------------------------------------------------------------ */

  /** Driver balances, deposits held and ageing buckets on `asOf` (entries dated up to then). */
  async receivables(q: ReceivablesReportQuery): Promise<ReportResult> {
    const asOf = q.asOf ?? this.clock.today();
    const [balanceRows, ageing] = await Promise.all([
      this.prisma.$queryRaw<unknown[]>`
        SELECT e."driverId",
          COALESCE(SUM(CASE WHEN e.type = 'CHARGE' THEN e.amount
                            WHEN e.type IN ('PAYMENT', 'CREDIT') THEN -e.amount
                            ELSE 0 END), 0)::numeric(14, 2) AS balance,
          COALESCE(SUM(CASE WHEN e.type = 'DEPOSIT_IN' THEN e.amount
                            WHEN e.type IN ('DEPOSIT_OUT', 'DEPOSIT_APPLIED') THEN -e.amount
                            ELSE 0 END), 0)::numeric(14, 2) AS deposit_held
        FROM "LedgerEntry" e
        WHERE e."voidedAt" IS NULL AND e.date <= ${asOf}::date
        GROUP BY e."driverId"`,
      this.ledger.ageing({ asOf }),
    ]);
    const balances = new Map(
      balanceRows.map((raw) => {
        const r = ReceivableBalanceRow.parse(raw);
        return [r.driverId, r] as const;
      }),
    );
    const ageByDriver = new Map(ageing.items.map((a) => [a.driverId, a]));
    const driverIds = [...new Set([...balances.keys(), ...ageByDriver.keys()])].filter((id) => {
      const b = balances.get(id);
      const a = ageByDriver.get(id);
      return (b && (!b.balance.isZero() || !b.deposit_held.isZero())) || (a && !a.total.isZero());
    });
    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: {
        id: true,
        contact: { select: { ...CONTACT_NAME_SELECT, phones: true } },
        contracts: {
          where: { startDate: { lte: dbDate(asOf) } },
          orderBy: [{ startDate: 'desc' }, { contractNo: 'desc' }],
          take: 1,
          select: { contractNo: true },
        },
      },
    });
    const columns = [
      col('driver', 'text'),
      col('phone', 'text'),
      col('contractNo', 'int'),
      col('balance', 'money'),
      col('depositHeld', 'money'),
      col('current', 'money'),
      col('d1_30', 'money'),
      col('d31_60', 'money'),
      col('d61_90', 'money'),
      col('d90_plus', 'money'),
      col('overdue', 'money'),
    ];
    const rows: ReportRow[] = drivers.map((d) => {
      const b = balances.get(d.id);
      const a = ageByDriver.get(d.id);
      const bucket = (v: Prisma.Decimal | undefined) => round2(v ?? 0);
      return {
        driver: contactDisplayName(d.contact),
        phone: firstPhone(d.contact.phones),
        contractNo: d.contracts[0]?.contractNo ?? null,
        balance: round2(b?.balance ?? 0),
        depositHeld: round2(b?.deposit_held ?? 0),
        current: bucket(a?.current),
        d1_30: bucket(a?.d1_30),
        d31_60: bucket(a?.d31_60),
        d61_90: bucket(a?.d61_90),
        d90_plus: bucket(a?.d90_plus),
        overdue: a ? round2(a.total.minus(a.current)) : 0,
      };
    });
    rows.sort(
      (x, y) =>
        (y.balance as number) - (x.balance as number) ||
        String(x.driver).localeCompare(String(y.driver)),
    );
    const totals = totalsOf(columns, rows);
    totals.contractNo = null;
    return { report: 'receivables', params: { asOf }, columns, rows, totals };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Expenses                                                                             */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Vehicle expenses dated in the period, grouped: count, amount (everyone), paid by us, VAT
   * reclaimable (VAT-inclusive amounts paid by us marked reclaimable) and our net cost.
   */
  async expenses(q: ExpensesReportQuery): Promise<ReportResult> {
    const { from, to } = resolveRange(q.from, q.to, this.clock.today());
    const [expenses, vatRate] = await Promise.all([
      this.prisma.vehicleExpense.findMany({
        where: { date: { gte: dbDate(from), lte: dbDate(to) } },
        select: {
          category: true,
          date: true,
          amount: true,
          paidBy: true,
          vatIncluded: true,
          vatReclaimable: true,
          vehicle: { select: VEHICLE_SELECT },
        },
      }),
      readVatRate(this.prisma),
    ]);
    const groupColumns: Record<ExpenseReportGroupBy, ReturnType<typeof col>[]> = {
      category: [col('category', 'enum', 'ExpenseCategory')],
      vehicle: [col('plateNo', 'plate'), col('vehicle', 'text')],
      month: [col('period', 'text')],
    };
    const columns = [
      ...groupColumns[q.groupBy],
      col('count', 'int'),
      col('amount', 'money'),
      col('paidByUs', 'money'),
      col('vatReclaimable', 'money'),
      col('netCost', 'money'),
    ];
    interface Acc {
      head: ReportRow;
      count: number;
      amount: Prisma.Decimal[];
      ours: Prisma.Decimal[];
      vat: number[];
    }
    const groups = new Map<string, Acc>();
    const groupOf = (key: string, head: () => ReportRow): Acc => {
      let g = groups.get(key);
      if (!g) {
        g = { head: head(), count: 0, amount: [], ours: [], vat: [] };
        groups.set(key, g);
      }
      return g;
    };
    if (q.groupBy === 'month') {
      for (const p of periodKeys(from, to, 'month')) groupOf(p, () => ({ period: p }));
    }
    for (const e of expenses) {
      const iso = isoOf(e.date);
      const g =
        q.groupBy === 'category'
          ? groupOf(e.category, () => ({ category: e.category }))
          : q.groupBy === 'vehicle'
            ? groupOf(e.vehicle.id, () => ({
                plateNo: e.vehicle.plateNo,
                vehicle: vehicleName(e.vehicle),
              }))
            : groupOf(periodKey(iso, 'month'), () => ({ period: periodKey(iso, 'month') }));
      g.count += 1;
      g.amount.push(e.amount);
      if (e.paidBy === 'US') {
        g.ours.push(e.amount);
        if (e.vatReclaimable && e.vatIncluded) g.vat.push(vatFromGross(e.amount, vatRate));
      }
    }
    let rows: ReportRow[] = [...groups.values()].map((g) => {
      const paidByUs = sumMoney(g.ours);
      const vat = sumMoney(g.vat);
      return {
        ...g.head,
        count: g.count,
        amount: sumMoney(g.amount),
        paidByUs,
        vatReclaimable: vat,
        netCost: sumMoney([paidByUs, -vat]),
      };
    });
    if (q.groupBy === 'month') rows = rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
    else rows = rows.sort((a, b) => (b.amount as number) - (a.amount as number));
    return {
      report: 'expenses',
      params: { from, to, groupBy: q.groupBy },
      columns,
      rows,
      totals: totalsOf(columns, rows),
    };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Lease income                                                                         */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Driver ledger by entry date: rent charged, other charges, credits, net (= charges -
   * credits) and payments received. Payments are not attributed to licences, so the
   * `license` grouping shows them as missing ("n/a").
   */
  async leaseIncome(q: LeaseIncomeReportQuery): Promise<ReportResult> {
    const { from, to } = resolveRange(q.from, q.to, this.clock.today());
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        voidedAt: null,
        type: { in: ['CHARGE', 'CREDIT', 'PAYMENT'] },
        date: { gte: dbDate(from), lte: dbDate(to) },
      },
      select: {
        type: true,
        chargeKind: true,
        amount: true,
        date: true,
        driverId: true,
        driver: { select: { contact: { select: CONTACT_NAME_SELECT } } },
        taxiLicenseId: true,
        taxiLicense: { select: { licenseNo: true } },
      },
    });
    const head =
      q.groupBy === 'month'
        ? [col('period', 'text')]
        : q.groupBy === 'license'
          ? [col('licenseNo', 'text')]
          : [col('driver', 'text')];
    const columns = [
      ...head,
      col('rentCharged', 'money'),
      col('otherCharges', 'money'),
      col('credits', 'money'),
      col('net', 'money'),
      col('paymentsReceived', 'money'),
    ];
    interface Acc {
      head: ReportRow;
      rent: Prisma.Decimal[];
      other: Prisma.Decimal[];
      credits: Prisma.Decimal[];
      payments: Prisma.Decimal[];
    }
    const groups = new Map<string, Acc>();
    const groupOf = (key: string, h: () => ReportRow): Acc => {
      let g = groups.get(key);
      if (!g) {
        g = { head: h(), rent: [], other: [], credits: [], payments: [] };
        groups.set(key, g);
      }
      return g;
    };
    if (q.groupBy === 'month') {
      for (const p of periodKeys(from, to, 'month')) groupOf(p, () => ({ period: p }));
    }
    for (const e of entries) {
      if (q.groupBy === 'license' && e.type === 'PAYMENT') continue;
      const p = periodKey(isoOf(e.date), 'month');
      const g =
        q.groupBy === 'month'
          ? groupOf(p, () => ({ period: p }))
          : q.groupBy === 'license'
            ? groupOf(e.taxiLicenseId ?? '', () => ({
                licenseNo: e.taxiLicense?.licenseNo ?? null,
              }))
            : groupOf(e.driverId, () => ({ driver: contactDisplayName(e.driver.contact) }));
      if (e.type === 'PAYMENT') g.payments.push(e.amount);
      else if (e.type === 'CREDIT') g.credits.push(e.amount);
      else if (e.chargeKind === 'RENT') g.rent.push(e.amount);
      else g.other.push(e.amount);
    }
    const rows: ReportRow[] = [...groups.values()].map((g) => {
      const rentCharged = sumMoney(g.rent);
      const otherCharges = sumMoney(g.other);
      const credits = sumMoney(g.credits);
      return {
        ...g.head,
        rentCharged,
        otherCharges,
        credits,
        net: sumMoney([rentCharged, otherCharges, -credits]),
        paymentsReceived: q.groupBy === 'license' ? null : sumMoney(g.payments),
      };
    });
    if (q.groupBy === 'month') rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
    else rows.sort((a, b) => (b.net as number) - (a.net as number));
    return {
      report: 'lease-income',
      params: { from, to, groupBy: q.groupBy },
      columns,
      rows,
      totals: totalsOf(columns, rows),
    };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Trade book                                                                           */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Trade book (sefer sachar): one row per inventory cycle bought (started) or sold (ended)
   * in the period - purchase, seller, our repairs, sale, buyer, VAT on the margin and profit.
   */
  async tradeBook(q: TradeBookQuery): Promise<ReportResult> {
    const { from, to } = resolveRange(q.from, q.to, this.clock.today());
    const range = { gte: dbDate(from), lte: dbDate(to) };
    const where: Prisma.InventoryCycleWhereInput = {
      AND: [NOT_CANCELLED, { OR: [{ startedAt: range }, { endedAt: range }] }],
    };
    const party = { select: { ...CONTACT_NAME_SELECT, idNumber: true } } as const;
    const [cycles, pnl] = await Promise.all([
      this.prisma.inventoryCycle.findMany({
        where,
        orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          kind: true,
          startedAt: true,
          endedAt: true,
          vehicle: { select: VEHICLE_SELECT },
          consignor: party,
          purchaseDeal: { select: { date: true, price: true, status: true, counterparty: party } },
          saleDeal: { select: { date: true, price: true, status: true, counterparty: party } },
          expenses: { where: { paidBy: 'US' }, select: { amount: true } },
        },
      }),
      this.pnl.cyclesPnl(where, [{ startedAt: 'asc' }]),
    ]);
    const pnlById = new Map(pnl.map((p) => [p.id, p]));
    const columns = [
      col('plateNo', 'plate'),
      col('vehicle', 'text'),
      col('consignment', 'bool'),
      col('purchaseDate', 'date'),
      col('sellerName', 'text'),
      col('sellerIdNumber', 'text'),
      col('purchasePrice', 'money'),
      col('repairsTotal', 'money'),
      col('saleDate', 'date'),
      col('buyerName', 'text'),
      col('buyerIdNumber', 'text'),
      col('salePrice', 'money'),
      col('vatOnMargin', 'money'),
      col('profit', 'money'),
    ];
    const rows: ReportRow[] = cycles.map((c) => {
      const consigned = c.kind === 'CONSIGNED';
      const purchase =
        !consigned && c.purchaseDeal && c.purchaseDeal.status !== 'CANCELLED'
          ? c.purchaseDeal
          : null;
      const sale = c.saleDeal && c.saleDeal.status === 'COMPLETED' ? c.saleDeal : null;
      const seller = consigned ? c.consignor : (purchase?.counterparty ?? null);
      const buyer = sale?.counterparty ?? null;
      const p = pnlById.get(c.id);
      const closed = c.endedAt !== null;
      return {
        plateNo: c.vehicle.plateNo,
        vehicle: vehicleName(c.vehicle),
        consignment: consigned,
        purchaseDate: isoOf(purchase?.date ?? c.startedAt),
        sellerName: seller ? contactDisplayName(seller) || null : null,
        sellerIdNumber: seller?.idNumber ?? null,
        purchasePrice: money(purchase?.price),
        repairsTotal: sumMoney(c.expenses.map((e) => e.amount)),
        saleDate: sale ? isoOf(sale.date) : null,
        buyerName: buyer ? contactDisplayName(buyer) || null : null,
        buyerIdNumber: buyer?.idNumber ?? null,
        salePrice: money(sale?.price),
        vatOnMargin: sale && p ? p.costs.vatOnMargin : null,
        profit: closed && p ? p.profit : null,
      };
    });
    rows.sort((a, b) => String(a.purchaseDate).localeCompare(String(b.purchaseDate)));
    return {
      report: 'trade-book',
      params: { from, to },
      columns,
      rows,
      totals: totalsOf(columns, rows),
    };
  }

  /* ------------------------------------------------------------------------------------ */
  /* Fines                                                                                */
  /* ------------------------------------------------------------------------------------ */

  /** Fines register by `receivedAt` (oldest first), optional status filter. */
  async fines(q: FinesReportQuery): Promise<ReportResult> {
    const { from, to } = resolveRange(q.from, q.to, this.clock.today());
    const fines = await this.prisma.trafficFine.findMany({
      where: {
        receivedAt: { gte: dbDate(from), lte: dbDate(to) },
        ...(q.status?.length ? { status: { in: q.status } } : {}),
      },
      orderBy: [{ receivedAt: 'asc' }, { offenceAt: 'asc' }, { id: 'asc' }],
      select: {
        fineNo: true,
        authority: true,
        offenceAt: true,
        receivedAt: true,
        amount: true,
        status: true,
        reassignDeadline: true,
        chargeEntryId: true,
        vehicle: { select: { plateNo: true } },
        driver: { select: { contact: { select: CONTACT_NAME_SELECT } } },
      },
    });
    const columns = [
      col('fineNo', 'text'),
      col('offenceAt', 'datetime'),
      col('receivedAt', 'date'),
      col('plateNo', 'plate'),
      col('driver', 'text'),
      col('authority', 'text'),
      col('amount', 'money'),
      col('status', 'enum', 'FineStatus'),
      col('reassignDeadline', 'date'),
      col('rebilled', 'bool'),
    ];
    const rows: ReportRow[] = fines.map((f) => ({
      fineNo: f.fineNo,
      offenceAt: f.offenceAt.toISOString(),
      receivedAt: isoOf(f.receivedAt),
      plateNo: f.vehicle.plateNo,
      driver: f.driver ? contactDisplayName(f.driver.contact) : null,
      authority: f.authority,
      amount: round2(f.amount),
      status: f.status,
      reassignDeadline: f.reassignDeadline ? isoOf(f.reassignDeadline) : null,
      rebilled: f.chargeEntryId !== null,
    }));
    return {
      report: 'fines',
      params: { from, to, ...(q.status?.length ? { status: q.status } : {}) },
      columns,
      rows,
      totals: totalsOf(columns, rows),
    };
  }
}
