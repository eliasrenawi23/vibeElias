import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { periodEnd, periodOf, periodStart, round2 } from '@renawi/shared';
import { Clock } from '../common/clock';
import { dbDate } from '../common/dates';
import { PnlService } from '../deals/pnl.service';
import { PrismaService } from '../prisma/prisma.service';

/** `GET /dashboard/kpis` (milestone 5 adds more). */
export interface DashboardKpis {
  /** Vehicles with status IN_STOCK (RESERVED / LEASED not counted). */
  vehiclesInStock: number;
  /** Lease contracts with status ACTIVE. */
  activeLeases: number;
  /** Sum of the positive driver balances (`driver_balance_v`). */
  receivables: number;
  /** Profit of the inventory cycles closed in the current month (Asia/Jerusalem). */
  monthProfit: number;
  /** DRAFT + PENDING deals. */
  openDeals: number;
  /** Completed sales past `transferDueAt` whose transfer is not DONE. */
  transfersOverdue: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly pnl: PnlService,
  ) {}

  async kpis(): Promise<DashboardKpis> {
    const today = this.clock.today();
    const period = periodOf(today);
    const [vehiclesInStock, activeLeases, openDeals, transfersOverdue, receivables] =
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
      ]);
    const monthProfit = await this.pnl.profitOfCyclesClosedBetween(
      periodStart(period),
      periodEnd(period),
    );
    return {
      vehiclesInStock,
      activeLeases,
      receivables: round2(receivables[0]?.total ?? 0),
      monthProfit,
      openDeals,
      transfersOverdue,
    };
  }
}
