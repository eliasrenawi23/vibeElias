import { Injectable } from '@nestjs/common';
import {
  AuditAction,
  LeaseContract,
  LeaseSegment,
  Prisma,
  Vehicle,
  VehicleStatus,
} from '@prisma/client';
import {
  addDays,
  contactDisplayName,
  maxIsoDate,
  minIsoDate,
  msg,
  normalizePlate,
  periodOf,
  type LeaseActivation,
  type LeaseChecklists,
  type LeaseDepositRequest,
  type LeaseDraftCreate,
  type LeaseDraftUpdate,
  type LeaseEndRequest,
  type LeaseQuery,
  type LeaseSummary,
  type LeaseSummaryQuery,
  LeaseStatus,
  type LeaseRenew,
  type LeaseSegmentCreate,
  type LeaseType,
  type Paginated,
} from '@renawi/shared';
import { AuditService } from '../common/audit/audit.service';
import { readDefaultResponsibilities, readLeadDays } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { AppException, ErrorKey, FieldErrorKey } from '../common/errors/app-exception';
import { searchTokens } from '../common/refs';
import { DocumentsService } from '../documents/documents.service';
import { LedgerService } from '../ledger/ledger.service';
import { toDbMoney } from '../prisma/prisma.decimal';
import { zeroCounts } from '../common/status-counts';
import { PrismaService } from '../prisma/prisma.service';
import { billingEnd, depositApplyAmount, penaltyAmount, toBillingContract } from './billing-plan';
import { LeaseBillingService } from './billing.service';
import { depositMethodOf, leaseAlerts, leaseVehicleProblem, statusAfterEnd } from './lease-rules';
import {
  LEASE_LIST_INCLUDE,
  LeaseDetail,
  LeaseListItem,
  LeaseWithRefs,
  OpenCharge,
  SEGMENT_INCLUDE,
  segmentRef,
  segmentView,
} from './lease-views';

type Tx = Prisma.TransactionClient;
type ContractWithSegments = LeaseContract & { segments: LeaseSegment[] };

const ZERO = new Prisma.Decimal(0);
const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'contractNo',
  'startDate',
  'endDate',
  'status',
  'type',
]);

/** Fields an ACTIVE contract still accepts on `PATCH /leases/:id`. */
const ACTIVE_EDITABLE = new Set(['endDate', 'paymentDay', 'terms', 'responsibilities', 'notes']);

/** Maps a violation of the open-segment partial unique indexes to the API's 409s. */
function rethrowSegmentConflict(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const text = `${JSON.stringify(e.meta ?? {})} ${e.message}`;
    if (/ls_open_license|taxiLicenseId/.test(text)) {
      throw AppException.conflict(ErrorKey.licenseInUse);
    }
    if (/ls_open_vehicle|vehicleId/.test(text)) throw AppException.conflict(ErrorKey.vehicleInUse);
  }
  throw e;
}

function openSegmentOf(c: ContractWithSegments): LeaseSegment | undefined {
  return c.segments
    .filter((s) => s.endDate === null)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
}

/** JSON-comparable form of a field value (Decimal / Date aware) for "did this field change?". */
function comparable(key: string, value: unknown): string {
  const instant = key === 'signedAt';
  if (value instanceof Date) return JSON.stringify(instant ? value.toISOString() : isoOf(value));
  if (instant && typeof value === 'string') return JSON.stringify(new Date(value).toISOString());
  if (value instanceof Prisma.Decimal) return JSON.stringify(value.toNumber());
  return JSON.stringify(value ?? null);
}

interface VehicleChange {
  before: Vehicle;
  after: Vehicle;
}

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly billing: LeaseBillingService,
    private readonly documents: DocumentsService,
  ) {}

  /* ------------------------------------------------------------------------------------ */
  /* Reads                                                                                */
  /* ------------------------------------------------------------------------------------ */

  /** Count per status under the list filters, ignoring `status` (one groupBy). */
  async summary(query: LeaseSummaryQuery): Promise<LeaseSummary> {
    const rows = await this.prisma.leaseContract.groupBy({
      by: ['status'],
      where: this.buildWhere({ ...query, status: undefined }),
      _count: { _all: true },
    });
    const counts = zeroCounts(LeaseStatus.options);
    for (const r of rows) counts[r.status] = r._count._all;
    return { counts };
  }

  async list(query: LeaseQuery): Promise<Paginated<LeaseListItem>> {
    const where = this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const orderBy: Prisma.LeaseContractOrderByWithRelationInput[] = [
      { [sort]: query.order },
      { id: 'asc' },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.leaseContract.count({ where }),
      this.prisma.leaseContract.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: LEASE_LIST_INCLUDE,
      }),
    ]);
    const today = this.clock.today();
    const [balances, overdue, lead] = await Promise.all([
      this.ledger.balancesFor(rows.map((r) => r.driverId)),
      this.overdueContracts(
        rows.map((r) => r.id),
        today,
      ),
      readLeadDays(this.prisma),
    ]);
    return {
      items: rows.map((r) => {
        const b = balances.get(r.driverId);
        return this.toListItem(
          r,
          { balance: b?.balance ?? ZERO, depositHeld: b?.depositHeld ?? ZERO },
          overdue.has(r.id),
          today,
          lead.lease,
        );
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<LeaseDetail> {
    const row = await this.prisma.leaseContract.findUnique({
      where: { id },
      include: {
        ...LEASE_LIST_INCLUDE,
        renewedFrom: { select: { id: true, contractNo: true } },
        renewedTo: { select: { id: true, contractNo: true } },
        _count: { select: { documents: true } },
      },
    });
    if (!row) throw AppException.notFound();
    const { renewedFrom, renewedTo, _count, ...withRefs } = row;
    const today = this.clock.today();
    const [history, balance, openCharges, lastPayment, lead] = await Promise.all([
      this.prisma.leaseSegment.findMany({
        where: { contractId: id },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        include: SEGMENT_INCLUDE,
      }),
      this.ledger.balanceOf(row.driverId),
      this.openCharges(id),
      this.prisma.ledgerEntry.findFirst({
        where: { driverId: row.driverId, type: 'PAYMENT', voidedAt: null },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { date: true, amount: true },
      }),
      readLeadDays(this.prisma),
    ]);
    const overdue = openCharges.some((c) => isoOf(c.dueDate ?? c.date) < today);
    const item = this.toListItem(withRefs, balance, overdue, today, lead.lease);
    return {
      ...item,
      segments: history.map(segmentView),
      balance,
      openCharges,
      lastPayment: lastPayment ?? null,
      renewedFrom: renewedFrom ?? null,
      renewedTo: renewedTo ?? null,
      documentCount: _count.documents,
    };
  }

  private async getRow(id: string, tx: Tx = this.prisma): Promise<ContractWithSegments> {
    const row = await tx.leaseContract.findUnique({ where: { id }, include: { segments: true } });
    if (!row) throw AppException.notFound();
    return row;
  }

  /* ------------------------------------------------------------------------------------ */
  /* Draft                                                                                */
  /* ------------------------------------------------------------------------------------ */

  /** Creates a DRAFT with its open first segment (which already locks the licence / car). */
  async create(dto: LeaseDraftCreate): Promise<LeaseDetail> {
    const today = this.clock.today();
    await this.checkDriver(dto.driverId);
    await this.checkLicense(dto.taxiLicenseId);
    const vehicleId = await this.checkVehicle(
      dto.type,
      dto.vehicleId ?? null,
      dto.driverId,
      maxIsoDate(today, dto.startDate),
      true,
    );
    await this.assertLicenseFree(dto.taxiLicenseId);
    if (vehicleId) await this.assertVehicleFree(vehicleId);
    const responsibilities =
      dto.responsibilities ?? (await readDefaultResponsibilities(this.prisma));
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const contract = await tx.leaseContract.create({
          data: {
            driverId: dto.driverId,
            type: dto.type,
            status: 'DRAFT',
            billingPeriod: dto.billingPeriod,
            startDate: dbDate(dto.startDate),
            endDate: dbDate(dto.endDate),
            paymentDay: dto.paymentDay,
            rentIncludesVat: dto.rentIncludesVat,
            earlyExitPenaltyMonths: new Prisma.Decimal(dto.earlyExitPenaltyMonths.toFixed(2)),
            depositAmount: toDbMoney(dto.depositAmount),
            depositKind: dto.depositKind,
            responsibilities,
            terms: dto.terms ?? null,
            notes: dto.notes ?? null,
            signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
          },
        });
        await tx.leaseSegment.create({
          data: {
            contractId: contract.id,
            taxiLicenseId: dto.taxiLicenseId,
            vehicleId,
            monthlyRent: toDbMoney(dto.monthlyRent),
            startDate: dbDate(dto.startDate),
          },
        });
        return contract.id;
      }, TX_OPTIONS);
    } catch (e) {
      rethrowSegmentConflict(e);
    }
    return this.get(id);
  }

  /**
   * DRAFT: any field (incl. the first segment). ACTIVE: endDate (not before today),
   * paymentDay, terms, responsibilities, notes. Otherwise 409 `errors.leaseNotEditable`.
   */
  async update(id: string, dto: LeaseDraftUpdate, userId: string | null): Promise<LeaseDetail> {
    const c = await this.getRow(id);
    if (c.status === 'DRAFT') await this.updateDraft(c, dto);
    else if (c.status === 'ACTIVE') await this.updateActive(c, dto, userId);
    else throw AppException.conflict(ErrorKey.leaseNotEditable);
    return this.get(id);
  }

  private async updateDraft(c: ContractWithSegments, dto: LeaseDraftUpdate): Promise<void> {
    const seg = openSegmentOf(c) ?? c.segments[0];
    if (!seg) throw AppException.conflict(ErrorKey.leaseNotEditable);
    const startDate = dto.startDate ?? isoOf(c.startDate);
    const endDate = dto.endDate ?? isoOf(c.endDate);
    if (endDate <= startDate) throw AppException.fieldError('endDate', FieldErrorKey.endAfterStart);
    const type: LeaseType = dto.type ?? c.type;
    const taxiLicenseId = dto.taxiLicenseId ?? seg.taxiLicenseId;
    const vehicleId = dto.vehicleId === undefined ? seg.vehicleId : dto.vehicleId;
    if (taxiLicenseId !== seg.taxiLicenseId) {
      await this.checkLicense(taxiLicenseId);
      await this.assertLicenseFree(taxiLicenseId, seg.id);
    }
    if (vehicleId !== seg.vehicleId || type !== c.type || startDate !== isoOf(c.startDate)) {
      const checked = await this.checkVehicle(
        type,
        vehicleId,
        c.driverId,
        maxIsoDate(this.clock.today(), startDate),
        true,
      );
      if (checked && checked !== seg.vehicleId) await this.assertVehicleFree(checked, seg.id);
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.leaseContract.update({
          where: { id: c.id },
          data: {
            type,
            billingPeriod: dto.billingPeriod,
            startDate: dbDate(startDate),
            endDate: dbDate(endDate),
            paymentDay: dto.paymentDay,
            rentIncludesVat: dto.rentIncludesVat,
            earlyExitPenaltyMonths:
              dto.earlyExitPenaltyMonths === undefined
                ? undefined
                : new Prisma.Decimal(dto.earlyExitPenaltyMonths.toFixed(2)),
            depositAmount:
              dto.depositAmount === undefined ? undefined : toDbMoney(dto.depositAmount),
            depositKind: dto.depositKind,
            responsibilities: dto.responsibilities,
            terms: dto.terms,
            notes: dto.notes,
            terminationNote: dto.terminationNote,
            signedAt:
              dto.signedAt === undefined ? undefined : dto.signedAt ? new Date(dto.signedAt) : null,
          },
        });
        await tx.leaseSegment.update({
          where: { id: seg.id },
          data: {
            taxiLicenseId,
            vehicleId,
            monthlyRent: dto.monthlyRent === undefined ? undefined : toDbMoney(dto.monthlyRent),
            startDate: dbDate(startDate),
          },
        });
      }, TX_OPTIONS);
    } catch (e) {
      rethrowSegmentConflict(e);
    }
  }

  private async updateActive(
    c: ContractWithSegments,
    dto: LeaseDraftUpdate,
    userId: string | null,
  ): Promise<void> {
    const seg = openSegmentOf(c);
    const current: Record<string, unknown> = {
      ...c,
      taxiLicenseId: seg?.taxiLicenseId,
      vehicleId: seg?.vehicleId ?? null,
      monthlyRent: seg?.monthlyRent,
    };
    const locked = Object.entries(dto).filter(
      ([key, value]) =>
        value !== undefined &&
        !ACTIVE_EDITABLE.has(key) &&
        comparable(key, value) !== comparable(key, current[key]),
    );
    if (locked.length) {
      throw AppException.conflict(
        ErrorKey.leaseNotEditable,
        locked.map(([path]) => ({ path, message: ErrorKey.leaseNotEditable })),
      );
    }
    const oldEnd = isoOf(c.endDate);
    const newEnd = dto.endDate ?? oldEnd;
    if (newEnd !== oldEnd) {
      if (newEnd < this.clock.today()) {
        throw AppException.fieldError('endDate', FieldErrorKey.dateInPast);
      }
      if (newEnd <= isoOf(c.startDate)) {
        throw AppException.fieldError('endDate', FieldErrorKey.endAfterStart);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.leaseContract.update({
        where: { id: c.id },
        data: {
          endDate: dbDate(newEnd),
          paymentDay: dto.paymentDay,
          terms: dto.terms,
          responsibilities: dto.responsibilities,
          notes: dto.notes,
        },
      });
      if (newEnd !== oldEnd) {
        const from = minIsoDate(oldEnd, newEnd);
        await this.billing.rebill(tx, c.id, periodOf(from), 'End date changed', userId);
        await this.billing.ensureCharges(tx, c.id, undefined, userId);
      }
    }, TX_OPTIONS);
  }

  /** Deletes a DRAFT (its segment and documents with it). */
  async remove(id: string): Promise<void> {
    const c = await this.getRow(id);
    if (c.status !== 'DRAFT') throw AppException.conflict(ErrorKey.leaseNotEditable);
    const docs = await this.prisma.document.findMany({
      where: { contractId: id },
      select: { fileKey: true, hasThumb: true },
    });
    await this.prisma.$transaction([
      this.prisma.leaseSegment.deleteMany({ where: { contractId: id } }),
      this.prisma.leaseContract.delete({ where: { id } }),
    ]);
    await this.documents.removeFiles(docs);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Lifecycle                                                                            */
  /* ------------------------------------------------------------------------------------ */

  /**
   * DRAFT -> ACTIVE: re-checks driver, licence and car, marks the car LEASED, records the
   * deposit (`DEPOSIT_IN`, amount defaulting to the contract's) and bills up to this month.
   */
  async activate(id: string, dto: LeaseActivation, userId: string | null): Promise<LeaseDetail> {
    const c = await this.getRow(id);
    if (c.status !== 'DRAFT') throw AppException.conflict(ErrorKey.invalidTransition);
    const seg = openSegmentOf(c);
    if (!seg) throw AppException.conflict(ErrorKey.invalidTransition);
    const today = this.clock.today();
    await this.checkDriver(c.driverId);
    await this.checkLicense(seg.taxiLicenseId);
    await this.checkVehicle(
      c.type,
      seg.vehicleId,
      c.driverId,
      maxIsoDate(today, isoOf(c.startDate)),
      true,
    );
    const depositAmount = dto.deposit
      ? new Prisma.Decimal(dto.deposit.amount ?? c.depositAmount)
      : ZERO;
    const changes: VehicleChange[] = [];
    await this.prisma.$transaction(async (tx) => {
      await tx.leaseContract.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          signedAt: dto.signedAt ? new Date(dto.signedAt) : (c.signedAt ?? new Date()),
          handoverChecklist: dto.handoverChecklist,
        },
      });
      if (c.type === 'CAR_AND_NUMBER' && seg.vehicleId) {
        changes.push(await this.setVehicleStatus(tx, seg.vehicleId, 'LEASED'));
      }
      if (dto.deposit && depositAmount.gt(0)) {
        await this.ledger.createEntry(tx, {
          driverId: c.driverId,
          contractId: id,
          type: 'DEPOSIT_IN',
          date: dto.deposit.date ?? today,
          amount: depositAmount,
          method: dto.deposit.method ?? depositMethodOf(dto.deposit.kind ?? c.depositKind),
          reference: dto.deposit.reference ?? null,
          description: dto.deposit.kind ?? c.depositKind,
          taxiLicenseId: seg.taxiLicenseId,
          userId,
        });
      }
      await this.billing.ensureCharges(tx, id, undefined, userId);
    }, TX_OPTIONS);
    await this.auditVehicles(changes, userId);
    return this.get(id);
  }

  /**
   * Car swap / licence change / rent change from `startDate`: closes the open segment the day
   * before, opens the new one, flips car statuses and re-bills the touched months.
   */
  async changeSegment(
    id: string,
    dto: LeaseSegmentCreate,
    userId: string | null,
  ): Promise<LeaseDetail> {
    const c = await this.getRow(id);
    if (c.status !== 'ACTIVE') throw AppException.conflict(ErrorKey.leaseNotEditable);
    const open = openSegmentOf(c);
    if (!open) throw AppException.conflict(ErrorKey.leaseNotEditable);
    if (dto.startDate <= isoOf(open.startDate)) {
      throw AppException.fieldError('startDate', FieldErrorKey.segmentStartTooEarly);
    }
    if (dto.startDate > billingEnd(toBillingContract(c))) {
      throw AppException.fieldError('startDate', FieldErrorKey.outsideContract);
    }
    const taxiLicenseId = dto.taxiLicenseId ?? open.taxiLicenseId;
    const vehicleId = dto.vehicleId === undefined ? open.vehicleId : dto.vehicleId;
    const monthlyRent =
      dto.monthlyRent === undefined ? open.monthlyRent : toDbMoney(dto.monthlyRent);
    const licenseChanged = taxiLicenseId !== open.taxiLicenseId;
    const vehicleChanged = vehicleId !== open.vehicleId;
    if (!licenseChanged && !vehicleChanged && monthlyRent.equals(open.monthlyRent)) {
      throw AppException.fieldError('monthlyRent', msg.nothingToChange);
    }
    if (c.type === 'CAR_AND_NUMBER' && !vehicleId) {
      throw AppException.fieldError('vehicleId', msg.required);
    }
    if (licenseChanged) {
      await this.checkLicense(taxiLicenseId);
      await this.assertLicenseFree(taxiLicenseId, open.id);
    }
    if (vehicleChanged && vehicleId) {
      await this.assertVehicleFree(vehicleId, open.id);
      await this.checkVehicle(
        c.type,
        vehicleId,
        c.driverId,
        maxIsoDate(this.clock.today(), dto.startDate),
        true,
      );
    }
    const changes: VehicleChange[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.leaseSegment.update({
          where: { id: open.id },
          data: { endDate: dbDate(addDays(dto.startDate, -1)) },
        });
        await tx.leaseSegment.create({
          data: {
            contractId: id,
            taxiLicenseId,
            vehicleId,
            monthlyRent,
            startDate: dbDate(dto.startDate),
            reason: dto.reason ?? null,
          },
        });
        if (c.type === 'CAR_AND_NUMBER' && vehicleChanged) {
          if (open.vehicleId) {
            changes.push(await this.setVehicleStatus(tx, open.vehicleId, 'IN_STOCK', 'LEASED'));
          }
          if (vehicleId) changes.push(await this.setVehicleStatus(tx, vehicleId, 'LEASED'));
        }
        await this.billing.rebill(
          tx,
          id,
          periodOf(dto.startDate),
          `Segment change from ${dto.startDate}`,
          userId,
        );
        await this.billing.ensureCharges(tx, id, undefined, userId);
      }, TX_OPTIONS);
    } catch (e) {
      rethrowSegmentConflict(e);
    }
    await this.auditVehicles(changes, userId);
    return this.get(id);
  }

  /**
   * Ends an ACTIVE contract on `actualEndDate`: closes the open segment, returns the car to
   * stock, credits charged days after the end, optionally charges the early-exit penalty and
   * returns / applies the held deposit.
   */
  async end(id: string, dto: LeaseEndRequest, userId: string | null): Promise<LeaseDetail> {
    const c = await this.getRow(id);
    if (c.status !== 'ACTIVE') throw AppException.conflict(ErrorKey.invalidTransition);
    const open = openSegmentOf(c);
    const minEnd = open
      ? maxIsoDate(isoOf(c.startDate), isoOf(open.startDate))
      : isoOf(c.startDate);
    if (dto.actualEndDate < minEnd) {
      throw AppException.fieldError('actualEndDate', FieldErrorKey.endAfterStart);
    }
    const today = this.clock.today();
    const changes: VehicleChange[] = [];
    await this.prisma.$transaction(async (tx) => {
      await tx.leaseContract.update({
        where: { id },
        data: {
          status: statusAfterEnd(dto.reason),
          endReason: dto.reason,
          actualEndDate: dbDate(dto.actualEndDate),
          terminationNote: dto.note,
          returnChecklist: dto.returnChecklist,
        },
      });
      if (open) {
        await tx.leaseSegment.update({
          where: { id: open.id },
          data: { endDate: dbDate(dto.actualEndDate) },
        });
        if (c.type === 'CAR_AND_NUMBER' && open.vehicleId) {
          changes.push(await this.setVehicleStatus(tx, open.vehicleId, 'IN_STOCK', 'LEASED'));
        }
      }
      // Bill what is still missing up to the end, then credit what was charged beyond it.
      await this.billing.ensureCharges(tx, id, undefined, userId);
      const attribution = {
        vehicleId: open?.vehicleId ?? null,
        taxiLicenseId: open?.taxiLicenseId ?? null,
      };
      await this.billing.creditUnusedDays(tx, id, attribution, userId);
      if (dto.applyPenalty && open) {
        const months = dto.penaltyMonths ?? c.earlyExitPenaltyMonths;
        const amount = penaltyAmount(months, open.monthlyRent);
        if (amount > 0) {
          await this.ledger.createEntry(tx, {
            driverId: c.driverId,
            contractId: id,
            type: 'CHARGE',
            chargeKind: 'PENALTY',
            date: dto.actualEndDate,
            dueDate: dto.actualEndDate,
            amount,
            description: `${new Prisma.Decimal(months).toString()} x ${open.monthlyRent.toFixed(2)}`,
            vehicleId: c.type === 'CAR_AND_NUMBER' ? open.vehicleId : null,
            taxiLicenseId: open.taxiLicenseId,
            userId,
          });
        }
      }
      await this.ledger.reallocateDriver(tx, c.driverId);
      if (dto.depositAction !== 'HOLD') {
        const { depositHeld, balance } = await this.ledger.balanceOf(c.driverId, tx);
        if (dto.depositAction === 'RETURN' && depositHeld.gt(0)) {
          await this.ledger.createEntry(tx, {
            driverId: c.driverId,
            contractId: id,
            type: 'DEPOSIT_OUT',
            date: today,
            amount: depositHeld,
            method: dto.depositMethod ?? 'CASH',
            description: dto.note ?? null,
            userId,
          });
        }
        if (dto.depositAction === 'APPLY') {
          const amount = depositApplyAmount(depositHeld, balance);
          if (amount > 0) {
            await this.ledger.applyDeposit(tx, {
              driverId: c.driverId,
              contractId: id,
              date: today,
              amount,
              description: dto.note ?? null,
              userId,
            });
            await this.ledger.reallocateDriver(tx, c.driverId);
          }
        }
      }
    }, TX_OPTIONS);
    await this.auditVehicles(changes, userId);
    return this.get(id);
  }

  /**
   * Renews an ACTIVE contract: the old one ends (RENEWED) the day before `startDate`, a new
   * ACTIVE contract (`renewedFromId`) continues on the same licence / car. The deposit stays
   * at driver level. Returns the NEW contract.
   */
  async renew(id: string, dto: LeaseRenew, userId: string | null): Promise<LeaseDetail> {
    const old = await this.getRow(id);
    if (old.status !== 'ACTIVE') throw AppException.conflict(ErrorKey.invalidTransition);
    const open = openSegmentOf(old);
    if (!open) throw AppException.conflict(ErrorKey.leaseNotEditable);
    const startDate = dto.startDate ?? addDays(isoOf(old.endDate), 1);
    if (startDate <= isoOf(open.startDate)) {
      throw AppException.fieldError('startDate', FieldErrorKey.segmentStartTooEarly);
    }
    if (dto.endDate <= startDate) {
      throw AppException.fieldError('endDate', FieldErrorKey.endAfterStart);
    }
    await this.checkDriver(old.driverId);
    await this.checkLicense(open.taxiLicenseId);
    if (open.vehicleId) {
      await this.checkVehicle(
        old.type,
        open.vehicleId,
        old.driverId,
        maxIsoDate(this.clock.today(), startDate),
        false,
      );
    }
    const actualEnd = addDays(startDate, -1);
    let newId: string;
    try {
      newId = await this.prisma.$transaction(async (tx) => {
        await tx.leaseContract.update({
          where: { id },
          data: { status: 'ENDED', endReason: 'RENEWED', actualEndDate: dbDate(actualEnd) },
        });
        await tx.leaseSegment.update({
          where: { id: open.id },
          data: { endDate: dbDate(actualEnd) },
        });
        await this.billing.ensureCharges(tx, id, undefined, userId);
        await this.billing.creditUnusedDays(
          tx,
          id,
          { vehicleId: open.vehicleId, taxiLicenseId: open.taxiLicenseId },
          userId,
        );
        const next = await tx.leaseContract.create({
          data: {
            driverId: old.driverId,
            type: old.type,
            status: 'ACTIVE',
            billingPeriod: old.billingPeriod,
            startDate: dbDate(startDate),
            endDate: dbDate(dto.endDate),
            paymentDay: dto.paymentDay ?? old.paymentDay,
            rentIncludesVat: old.rentIncludesVat,
            earlyExitPenaltyMonths:
              dto.earlyExitPenaltyMonths === undefined
                ? old.earlyExitPenaltyMonths
                : new Prisma.Decimal(dto.earlyExitPenaltyMonths.toFixed(2)),
            depositAmount: old.depositAmount,
            depositKind: old.depositKind,
            responsibilities:
              dto.responsibilities ?? (old.responsibilities as Prisma.InputJsonValue),
            terms: dto.terms === undefined ? old.terms : dto.terms,
            notes: old.notes,
            renewedFromId: id,
            signedAt: new Date(),
          },
        });
        await tx.leaseSegment.create({
          data: {
            contractId: next.id,
            taxiLicenseId: open.taxiLicenseId,
            vehicleId: open.vehicleId,
            monthlyRent:
              dto.monthlyRent === undefined ? open.monthlyRent : toDbMoney(dto.monthlyRent),
            startDate: dbDate(startDate),
            reason: 'RENEWED',
          },
        });
        await this.billing.ensureCharges(tx, next.id, undefined, userId);
        await this.ledger.reallocateDriver(tx, old.driverId);
        return next.id;
      }, TX_OPTIONS);
    } catch (e) {
      rethrowSegmentConflict(e);
    }
    await this.audit.record({
      userId,
      entity: 'LeaseContract',
      entityId: newId,
      action: AuditAction.CREATE,
      after: await this.prisma.leaseContract.findUnique({ where: { id: newId } }),
    });
    return this.get(newId);
  }

  /** Deposit received (IN), returned (OUT) or applied to the open balance (APPLY). */
  async deposit(id: string, dto: LeaseDepositRequest, userId: string | null): Promise<LeaseDetail> {
    const c = await this.getRow(id);
    if (c.status === 'DRAFT') throw AppException.conflict(ErrorKey.invalidTransition);
    const date = dto.date ?? this.clock.today();
    await this.prisma.$transaction(async (tx) => {
      const { depositHeld } = await this.ledger.balanceOf(c.driverId, tx);
      const amount = toDbMoney(dto.amount);
      if (dto.action !== 'IN' && amount.gt(depositHeld)) {
        throw AppException.conflict(ErrorKey.depositInsufficient);
      }
      if (dto.action === 'APPLY') {
        await this.ledger.applyDeposit(tx, {
          driverId: c.driverId,
          contractId: id,
          date,
          amount,
          description: dto.note ?? null,
          userId,
        });
        await this.ledger.reallocateDriver(tx, c.driverId);
        return;
      }
      await this.ledger.createEntry(tx, {
        driverId: c.driverId,
        contractId: id,
        type: dto.action === 'IN' ? 'DEPOSIT_IN' : 'DEPOSIT_OUT',
        date,
        amount,
        method:
          dto.method ?? (dto.action === 'IN' ? depositMethodOf(dto.kind ?? c.depositKind) : 'CASH'),
        reference: dto.reference ?? null,
        description: dto.note ?? (dto.action === 'IN' ? (dto.kind ?? c.depositKind) : null),
        userId,
      });
    }, TX_OPTIONS);
    return this.get(id);
  }

  async checklists(id: string, dto: LeaseChecklists): Promise<LeaseDetail> {
    await this.getRow(id);
    await this.prisma.leaseContract.update({
      where: { id },
      data: { handoverChecklist: dto.handoverChecklist, returnChecklist: dto.returnChecklist },
    });
    return this.get(id);
  }

  /* ------------------------------------------------------------------------------------ */
  /* Checks                                                                               */
  /* ------------------------------------------------------------------------------------ */

  private async checkDriver(driverId: string): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { status: true },
    });
    if (!driver) throw AppException.notFoundField('driverId');
    if (driver.status !== 'ACTIVE') throw AppException.conflict(ErrorKey.driverInactive);
  }

  private async checkLicense(taxiLicenseId: string): Promise<void> {
    const license = await this.prisma.taxiLicense.findUnique({
      where: { id: taxiLicenseId },
      select: { status: true },
    });
    if (!license) throw AppException.notFoundField('taxiLicenseId');
    if (license.status !== 'ACTIVE') throw AppException.conflict(ErrorKey.licenseNotActive);
  }

  /**
   * Validates the segment car for the lease type (see `leaseVehicleProblem`); CAR_AND_NUMBER
   * needs one. Returns the vehicle id (or null for a NUMBER_ONLY lease without a car).
   */
  private async checkVehicle(
    type: LeaseType,
    vehicleId: string | null,
    driverId: string,
    onDate: string,
    requireInStock: boolean,
  ): Promise<string | null> {
    if (!vehicleId) {
      if (type === 'CAR_AND_NUMBER') throw AppException.fieldError('vehicleId', msg.required);
      return null;
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw AppException.notFoundField('vehicleId');
    const problem = leaseVehicleProblem(type, vehicle, driverId, onDate, requireInStock);
    if (problem) throw AppException.conflict(problem);
    return vehicleId;
  }

  private async assertLicenseFree(taxiLicenseId: string, exceptSegmentId?: string) {
    const taken = await this.prisma.leaseSegment.findFirst({
      where: {
        taxiLicenseId,
        endDate: null,
        ...(exceptSegmentId ? { id: { not: exceptSegmentId } } : {}),
      },
      select: { id: true },
    });
    if (taken) throw AppException.conflict(ErrorKey.licenseInUse);
  }

  private async assertVehicleFree(vehicleId: string, exceptSegmentId?: string) {
    const taken = await this.prisma.leaseSegment.findFirst({
      where: {
        vehicleId,
        endDate: null,
        ...(exceptSegmentId ? { id: { not: exceptSegmentId } } : {}),
      },
      select: { id: true },
    });
    if (taken) throw AppException.conflict(ErrorKey.vehicleInUse);
  }

  /** Sets a vehicle status (only from `onlyFrom` when given) and returns before/after. */
  private async setVehicleStatus(
    tx: Tx,
    vehicleId: string,
    status: VehicleStatus,
    onlyFrom?: VehicleStatus,
  ): Promise<VehicleChange> {
    const before = await tx.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    if (before.status === status || (onlyFrom && before.status !== onlyFrom)) {
      return { before, after: before };
    }
    const after = await tx.vehicle.update({ where: { id: vehicleId }, data: { status } });
    return { before, after };
  }

  private async auditVehicles(changes: VehicleChange[], userId: string | null): Promise<void> {
    for (const { before, after } of changes) {
      if (before.status === after.status) continue;
      await this.audit.record({
        userId,
        entity: 'Vehicle',
        entityId: before.id,
        action: AuditAction.UPDATE,
        before,
        after,
      });
    }
  }

  /* ------------------------------------------------------------------------------------ */
  /* View helpers                                                                         */
  /* ------------------------------------------------------------------------------------ */

  private toListItem(
    row: LeaseWithRefs,
    balance: LeaseListItem['balance'],
    overdue: boolean,
    today: string,
    leadDays: number,
  ): LeaseListItem {
    const { driver, segments, ...contract } = row;
    const open = segments[0];
    return {
      ...contract,
      driver: { id: driver.id, name: contactDisplayName(driver.contact) },
      currentSegment: open ? segmentRef(open) : null,
      balance,
      alerts: leaseAlerts(
        { status: contract.status, endDate: isoOf(contract.endDate), overdue },
        today,
        leadDays,
      ),
    };
  }

  /** Charges of a contract with an open remainder (FIFO cache), oldest due first. */
  private async openCharges(contractId: string): Promise<OpenCharge[]> {
    const charges = await this.prisma.ledgerEntry.findMany({
      where: { contractId, type: 'CHARGE', voidedAt: null },
      orderBy: [{ dueDate: 'asc' }, { date: 'asc' }, { createdAt: 'asc' }],
      include: { allocationsAsCharge: { select: { amount: true } } },
    });
    const out: OpenCharge[] = [];
    for (const c of charges) {
      const allocated = c.allocationsAsCharge.reduce((s, a) => s.plus(a.amount), ZERO);
      const remaining = c.amount.minus(allocated);
      if (remaining.lte(0)) continue;
      out.push({
        id: c.id,
        chargeKind: c.chargeKind,
        rentPeriod: c.rentPeriod,
        date: c.date,
        dueDate: c.dueDate,
        amount: c.amount,
        remaining,
        description: c.description,
      });
    }
    return out;
  }

  /** Contracts (of the given ids) with an open charge past its due date. */
  private async overdueContracts(ids: readonly string[], today: string): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const before = dbDate(today);
    const charges = await this.prisma.ledgerEntry.findMany({
      where: {
        contractId: { in: [...ids] },
        type: 'CHARGE',
        voidedAt: null,
        OR: [{ dueDate: { lt: before } }, { dueDate: null, date: { lt: before } }],
      },
      select: {
        contractId: true,
        amount: true,
        allocationsAsCharge: { select: { amount: true } },
      },
    });
    const out = new Set<string>();
    for (const c of charges) {
      const allocated = c.allocationsAsCharge.reduce((s, a) => s.plus(a.amount), ZERO);
      if (c.contractId && c.amount.gt(allocated)) out.add(c.contractId);
    }
    return out;
  }

  private buildWhere(
    query: LeaseSummaryQuery & { status?: LeaseQuery['status'] },
  ): Prisma.LeaseContractWhereInput {
    const and: Prisma.LeaseContractWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.type) and.push({ type: query.type });
    if (query.driverId) and.push({ driverId: query.driverId });
    if (query.taxiLicenseId)
      and.push({ segments: { some: { taxiLicenseId: query.taxiLicenseId } } });
    if (query.vehicleId) and.push({ segments: { some: { vehicleId: query.vehicleId } } });
    if (query.endingBefore) and.push({ endDate: { lte: dbDate(query.endingBefore) } });
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.LeaseContractWhereInput[] = [
        { driver: { contact: { firstName: text } } },
        { driver: { contact: { lastName: text } } },
        { driver: { contact: { companyName: text } } },
        { segments: { some: { taxiLicense: { licenseNo: text } } } },
      ];
      if (/^\d{1,9}$/.test(token)) or.push({ contractNo: Number(token) });
      const plate = normalizePlate(token);
      if (/^\d{2,8}$/.test(plate)) {
        or.push({ segments: { some: { vehicle: { plateNo: { contains: plate } } } } });
      }
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
