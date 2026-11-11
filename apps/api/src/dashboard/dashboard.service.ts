import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  periodEnd,
  periodOf,
  periodStart,
  round2,
  type ActivityItem,
  type DashboardCharts,
  type DashboardKpis,
} from '@renawi/shared';
import { Clock } from '../common/clock';
import { dbDate } from '../common/dates';
import { PnlService } from '../deals/pnl.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RemindersFeedService } from '../reminders/reminders-feed.service';
import { lastMonthsRange } from '../reports/report-rules';
import { ReportsService } from '../reports/reports.service';
import { ActivityService } from './activity.service';

export type { DashboardKpis };

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly pnl: PnlService,
    private readonly ledger: LedgerService,
    private readonly feed: RemindersFeedService,
    private readonly reports: ReportsService,
    private readonly activityService: ActivityService,
  ) {}

  async kpis(): Promise<DashboardKpis> {
    const today = this.clock.today();
    const period = periodOf(today);
    const [vehiclesInStock, activeLeases, openDeals, transfersOverdue, receivables, finesOpen] =
      await Promise.all([
        this.prisma.vehicle.count({ where: { status: 'IN_STOCK' } }),
        this.prisma.leaseContract.count({ where: { status: 'ACTIVE' } }),
        this.prisma.deal.count({ where: { status: { in: ['DRAFT', 'PENDING'] } } }),
        this.prisma.deal.count({
          where: {
            type: { in: ['SALE', 'CONSIGNMENT_SALE'] },
            status: 'COMPLETED',
            transferStatus: { not: 'DONE' },
            transferDueAt: { lt: dbDate(today) },
          },
        }),
        this.prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>`
          SELECT COALESCE(SUM(balance) FILTER (WHERE balance > 0), 0)::numeric(14, 2) AS total
          FROM driver_balance_v`,
        this.prisma.trafficFine.count({ where: { status: { in: ['NEW', 'REASSIGN_SUBMITTED'] } } }),
      ]);
    const [monthProfit, counts, ageing] = await Promise.all([
      this.pnl.profitOfCyclesClosedBetween(periodStart(period), periodEnd(period)),
      this.feed.counts(30),
      this.ledger.ageing({}),
    ]);
    return {
      vehiclesInStock,
      activeLeases,
      receivables: round2(receivables[0]?.total ?? 0),
      monthProfit,
      openDeals,
      transfersOverdue,
      expiring: { overdue: counts.overdue, due: counts.due },
      finesOpen,
      receivablesOverdue: round2(ageing.totals.total.minus(ageing.totals.current)),
    };
  }

  activity(limit: number): Promise<ActivityItem[]> {
    return this.activityService.recent(limit);
  }

  async charts(months: number): Promise<DashboardCharts> {
    const { from, to } = lastMonthsRange(this.clock.today(), months);
    const [periods, ageing, groups] = await Promise.all([
      this.reports.profitPeriods(from, to, 'month'),
      this.ledger.ageing({}),
      this.prisma.vehicle.groupBy({
        by: ['status', 'ownership'],
        where: { status: { in: ['IN_STOCK', 'RESERVED', 'LEASED'] } },
        _count: { _all: true },
      }),
    ]);
    const count = (pred: (g: (typeof groups)[number]) => boolean) =>
      groups.filter(pred).reduce((n, g) => n + g._count._all, 0);
    const t = ageing.totals;
    return {
      profitByMonth: periods.map((p) => ({
        period: p.period,
        sales: p.salesRevenue,
        leaseIncome: p.leaseIncome,
        commission: p.commission,
        costs: round2(p.purchaseCost + p.expenses + p.vatOnMargin),
        profit: p.profit,
      })),
      receivablesAgeing: {
        current: round2(t.current),
        d1_30: round2(t.d1_30),
        d31_60: round2(t.d31_60),
        d61_90: round2(t.d61_90),
        d90_plus: round2(t.d90_plus),
      },
      inventory: {
        inStock: count((g) => g.ownership === 'OWNED' && g.status === 'IN_STOCK'),
        reserved: count((g) => g.ownership === 'OWNED' && g.status === 'RESERVED'),
        leased: count((g) => g.ownership === 'OWNED' && g.status === 'LEASED'),
        consigned: count(
          (g) => g.ownership === 'CONSIGNED' && (g.status === 'IN_STOCK' || g.status === 'RESERVED'),
        ),
      },
    };
  }
}
