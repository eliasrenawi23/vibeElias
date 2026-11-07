import { Injectable, Logger } from '@nestjs/common';
import { LeaseContract, LeaseSegment, Prisma } from '@prisma/client';
import {
  addPeriods,
  contactDisplayName,
  monthsBetween,
  msg,
  periodOf,
  periodStart,
  type LeaseStatus,
} from '@renawi/shared';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { CONTACT_NAME_SELECT, NamedRef } from '../common/refs';
import { LedgerService } from '../ledger/ledger.service';
import { toDbMoney } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import {
  planRebill,
  planRentCharges,
  PlannedRentCharge,
  toBillingContract,
  toBillingSegments,
  unusedRentCredits,
} from './billing-plan';

type Tx = Prisma.TransactionClient;
type ContractWithSegments = LeaseContract & { segments: LeaseSegment[] };

/** Ended contracts are still billed for this many months back (late cron, future end date). */
const ENDED_LOOKBACK_MONTHS = 3;

/** A rent line `ensureCharges` would create (`GET /leases/billing/preview`). */
export interface PreviewCharge extends PlannedRentCharge {
  contractId: string;
  contractNo: number;
  contractStatus: LeaseStatus;
  driver: NamedRef;
}

/**
 * Rent billing (plan, "Ledger design"): idempotent generation of RENT charges per segment and
 * month (`@@unique([segmentId, rentPeriod])` + `createMany({ skipDuplicates })`), re-billing of
 * months touched by segment / end-date changes, and the unused-days credit of an early end.
 */
@Injectable()
export class LeaseBillingService {
  private readonly logger = new Logger(LeaseBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly ledger: LedgerService,
  ) {}

  /** Current billing month in the business time zone. */
  currentPeriod(): string {
    return periodOf(this.clock.today());
  }

  /**
   * Creates the missing RENT charges of a (non-draft) contract from its first month up to
   * `upto` (default: the current month). Re-runs are no-ops. Returns the number created.
   */
  async ensureCharges(
    tx: Tx,
    contractId: string,
    upto: string = this.currentPeriod(),
    userId: string | null = null,
  ): Promise<number> {
    const c = await tx.leaseContract.findUnique({
      where: { id: contractId },
      include: { segments: true },
    });
    if (!c || c.status === 'DRAFT' || c.billingPeriod !== 'MONTHLY') return 0;
    const planned = planRentCharges(toBillingContract(c), toBillingSegments(c.segments), upto);
    if (planned.length === 0) return 0;
    const { count } = await tx.ledgerEntry.createMany({
      data: planned.map((p) => this.chargeData(c, p, userId)),
      skipDuplicates: true,
    });
    if (count > 0) await this.ledger.reallocateDriver(tx, c.driverId);
    return count;
  }

  /**
   * Re-bills the months from `fromPeriod` on (up to the later of the current month and the last
   * billed month): charges that no longer match the segments are voided (and detached from
   * their segment so the month can be billed again), the matching lines are created.
   */
  async rebill(
    tx: Tx,
    contractId: string,
    fromPeriod: string,
    reason: string,
    userId: string | null = null,
  ): Promise<{ voided: number; created: number }> {
    const c = await tx.leaseContract.findUniqueOrThrow({
      where: { id: contractId },
      include: { segments: true },
    });
    if (c.status === 'DRAFT') return { voided: 0, created: 0 };
    const last = await tx.ledgerEntry.aggregate({
      where: { contractId, type: 'CHARGE', chargeKind: 'RENT', voidedAt: null },
      _max: { rentPeriod: true },
    });
    const current = this.currentPeriod();
    const lastBilled = last._max.rentPeriod;
    const upto = lastBilled && lastBilled > current ? lastBilled : current;
    const periods = monthsBetween(fromPeriod, upto);
    if (periods.length === 0) return { voided: 0, created: 0 };
    const existing = await tx.ledgerEntry.findMany({
      where: {
        contractId,
        type: 'CHARGE',
        chargeKind: 'RENT',
        voidedAt: null,
        rentPeriod: { gte: fromPeriod, lte: upto },
      },
      select: { id: true, segmentId: true, rentPeriod: true, amount: true },
    });
    const plan = planRebill(
      toBillingContract(c),
      toBillingSegments(c.segments),
      periods,
      existing.map((e) => ({ ...e, rentPeriod: e.rentPeriod ?? '' })),
    );
    if (plan.voidIds.length) {
      await tx.ledgerEntry.updateMany({
        where: { id: { in: plan.voidIds } },
        data: { voidedAt: new Date(), voidReason: reason, segmentId: null },
      });
    }
    let created = 0;
    if (plan.create.length) {
      ({ count: created } = await tx.ledgerEntry.createMany({
        data: plan.create.map((p) => this.chargeData(c, p, userId)),
        skipDuplicates: true,
      }));
    }
    if (plan.voidIds.length || created) await this.ledger.reallocateDriver(tx, c.driverId);
    return { voided: plan.voidIds.length, created };
  }

  /**
   * After an early end (`actualEndDate` and the closed segment already saved): one CREDIT per
   * month for the charged rent after the end date. Returns the credits' total count.
   */
  async creditUnusedDays(
    tx: Tx,
    contractId: string,
    attribution: { vehicleId: string | null; taxiLicenseId: string | null },
    userId: string | null,
  ): Promise<number> {
    const c = await tx.leaseContract.findUniqueOrThrow({
      where: { id: contractId },
      include: { segments: true },
    });
    const existing = await tx.ledgerEntry.findMany({
      where: { contractId, type: 'CHARGE', chargeKind: 'RENT', voidedAt: null },
      select: { id: true, segmentId: true, rentPeriod: true, amount: true },
    });
    const credits = unusedRentCredits(
      toBillingContract(c),
      toBillingSegments(c.segments),
      existing.map((e) => ({ ...e, rentPeriod: e.rentPeriod ?? '' })),
    );
    for (const credit of credits) {
      await this.ledger.createEntry(tx, {
        driverId: c.driverId,
        contractId,
        type: 'CREDIT',
        date: isoOf(c.actualEndDate ?? c.endDate),
        amount: credit.amount,
        description: `${credit.from} – ${credit.to}`,
        vehicleId: c.type === 'CAR_AND_NUMBER' ? attribution.vehicleId : null,
        taxiLicenseId: attribution.taxiLicenseId,
        autoGenerated: true,
        userId,
      });
    }
    return credits.length;
  }

  /** Contracts the billing run processes for `period`. */
  async candidateIds(period: string): Promise<string[]> {
    const since = dbDate(periodStart(addPeriods(period, -ENDED_LOOKBACK_MONTHS)));
    const rows = await this.prisma.leaseContract.findMany({
      where: {
        billingPeriod: 'MONTHLY',
        OR: [
          { status: 'ACTIVE' },
          { status: { in: ['ENDED', 'TERMINATED'] }, actualEndDate: { gte: since } },
        ],
      },
      orderBy: { contractNo: 'asc' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** `POST /leases/billing/run` and the nightly job. */
  async run(
    period: string = this.currentPeriod(),
    contractId?: string,
    userId: string | null = null,
  ): Promise<{ created: number; contracts: number; period: string }> {
    this.assertPeriod(period);
    const ids = contractId ? [contractId] : await this.candidateIds(period);
    let created = 0;
    for (const id of ids) {
      created += await this.prisma.$transaction((tx) => this.ensureCharges(tx, id, period, userId));
    }
    if (created) this.logger.log(`Billing ${period}: ${created} rent charges on ${ids.length}`);
    return { created, contracts: ids.length, period };
  }

  /**
   * `GET /leases/billing/preview`: the lines `ensureCharges` would create up to `period`. With a
   * `contractId` a DRAFT is previewed as if it were activated now.
   */
  async preview(
    period: string = this.currentPeriod(),
    contractId?: string,
  ): Promise<{ period: string; charges: PreviewCharge[] }> {
    this.assertPeriod(period);
    const ids = contractId ? [contractId] : await this.candidateIds(period);
    const contracts = await this.prisma.leaseContract.findMany({
      where: { id: { in: ids } },
      orderBy: { contractNo: 'asc' },
      include: {
        segments: true,
        driver: { select: { id: true, contact: { select: CONTACT_NAME_SELECT } } },
      },
    });
    if (contractId && contracts.length === 0) throw AppException.notFound();
    const charges: PreviewCharge[] = [];
    for (const c of contracts) {
      if (c.billingPeriod !== 'MONTHLY') continue;
      const planned = planRentCharges(toBillingContract(c), toBillingSegments(c.segments), period);
      if (planned.length === 0) continue;
      const taken = await this.prisma.ledgerEntry.findMany({
        where: { segmentId: { in: c.segments.map((s) => s.id) }, rentPeriod: { not: null } },
        select: { segmentId: true, rentPeriod: true },
      });
      const slots = new Set(taken.map((t) => `${t.segmentId}|${t.rentPeriod}`));
      for (const p of planned) {
        if (slots.has(`${p.segmentId}|${p.rentPeriod}`)) continue;
        charges.push({
          ...p,
          contractId: c.id,
          contractNo: c.contractNo,
          contractStatus: c.status,
          driver: { id: c.driver.id, name: contactDisplayName(c.driver.contact) },
        });
      }
    }
    return { period, charges };
  }

  /** At most one month ahead of the current month. */
  private assertPeriod(period: string): void {
    if (period > addPeriods(this.currentPeriod(), 1)) {
      throw AppException.fieldError('period', msg.invalidPeriod);
    }
  }

  private chargeData(
    c: ContractWithSegments,
    p: PlannedRentCharge,
    userId: string | null,
  ): Prisma.LedgerEntryCreateManyInput {
    return {
      driverId: c.driverId,
      contractId: c.id,
      segmentId: p.segmentId,
      type: 'CHARGE',
      chargeKind: 'RENT',
      rentPeriod: p.rentPeriod,
      date: dbDate(p.date),
      dueDate: dbDate(p.dueDate),
      amount: toDbMoney(p.amount),
      vehicleId: p.vehicleId,
      taxiLicenseId: p.taxiLicenseId,
      description: `${p.date} – ${p.to}`,
      autoGenerated: true,
      createdById: userId,
    };
  }
}
