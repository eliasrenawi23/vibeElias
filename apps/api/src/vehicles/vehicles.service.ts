import { Injectable } from '@nestjs/common';
import { AuditAction, InventoryCycle, Prisma, Vehicle } from '@prisma/client';
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  msg,
  normalizePlate,
  ReminderLeadDaysSchema,
  type Paginated,
  type VehicleCreate,
  type VehicleQuery,
  type VehicleSummary,
  type VehicleSummaryQuery,
  VehicleStatus,
  type VehicleStatusChange,
  type VehicleUpdate,
} from '@renawi/shared';
import { AuditService } from '../common/audit/audit.service';
import { Clock } from '../common/clock';
import { dbDate, dbDateOpt, isoOf, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { CONTACT_NAME_SELECT, searchTokens } from '../common/refs';
import { toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { zeroCounts } from '../common/status-counts';
import { PrismaService } from '../prisma/prisma.service';
import { checkStatusTransition, STOCK_STATUSES, vehicleAlerts } from './vehicle-rules';
import {
  summarizeExpenses,
  toCycleViews,
  toListItemBase,
  VEHICLE_LIST_INCLUDE,
  VehicleDetail,
  VehicleListItem,
  VehicleWithRefs,
} from './vehicle-views';

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'plateNo',
  'make',
  'model',
  'year',
  'status',
  'currentKm',
  'registrationExpiry',
  'listingPrice',
]);
const NULLABLE_SORT_FIELDS = new Set(['currentKm', 'registrationExpiry', 'listingPrice']);

type Tx = Prisma.TransactionClient;

/** Re-throws a unique violation on plateNo / vin as 409 `validation.duplicate`. */
function rethrowUnique(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = e.meta?.target;
    const fields = (Array.isArray(target) ? target : [target]).map((t) => String(t ?? ''));
    if (fields.some((f) => f.includes('plateNo'))) throw AppException.duplicate('plateNo');
    if (fields.some((f) => f.includes('vin'))) throw AppException.duplicate('vin');
  }
  throw e;
}

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  /* ------------------------------------------------------------------------------------ */
  /* Reads                                                                                */
  /* ------------------------------------------------------------------------------------ */

  /** Count per status under the list filters, ignoring `status` (one groupBy). */
  async summary(query: VehicleSummaryQuery): Promise<VehicleSummary> {
    const rows = await this.prisma.vehicle.groupBy({
      by: ['status'],
      where: this.buildWhere({ ...query, status: undefined }),
      _count: { _all: true },
    });
    const counts = zeroCounts(VehicleStatus.options);
    for (const r of rows) counts[r.status] = r._count._all;
    return { counts };
  }

  async list(query: VehicleQuery): Promise<Paginated<VehicleListItem>> {
    const where = this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      NULLABLE_SORT_FIELDS.has(sort)
        ? { [sort]: { sort: query.order, nulls: 'last' } }
        : { [sort]: query.order },
      { id: 'asc' },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where }),
      this.prisma.vehicle.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: VEHICLE_LIST_INCLUDE,
      }),
    ]);
    const today = this.clock.today();
    const leadDays = await this.registrationLeadDays();
    return {
      items: rows.map((r) => this.toListItem(r, today, leadDays)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<VehicleDetail> {
    const row = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        ...VEHICLE_LIST_INCLUDE,
        insurance: { orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }] },
        odometer: { orderBy: [{ date: 'desc' }, { km: 'desc' }], take: 20 },
        _count: { select: { documents: true } },
      },
    });
    if (!row) throw AppException.notFound();
    const { insurance, odometer, _count, ...withRefs } = row;
    const item = this.toListItem(withRefs, this.clock.today(), await this.registrationLeadDays());
    const cycles = await this.cycleViews(id);
    const open = item.openCycle;
    const openExpenses = open
      ? await this.prisma.vehicleExpense.findMany({
          where: { cycleId: open.id },
          select: { category: true, amount: true, paidBy: true },
        })
      : [];
    return {
      ...item,
      cycles,
      insurance,
      odometer,
      expenseSummary: { cycleId: open?.id ?? null, ...summarizeExpenses(openExpenses) },
      documentCount: _count.documents,
    };
  }

  /** All cycles of a vehicle, newest first, with consignor and expense totals. */
  async cycleViews(vehicleId: string) {
    const [cycles, sums] = await Promise.all([
      this.prisma.inventoryCycle.findMany({
        where: { vehicleId },
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        include: { consignor: { select: CONTACT_NAME_SELECT } },
      }),
      this.prisma.vehicleExpense.groupBy({
        by: ['cycleId', 'paidBy'],
        where: { vehicleId },
        _sum: { amount: true },
      }),
    ]);
    return toCycleViews(cycles, sums);
  }

  /** Vehicle row or 404 (`field` adds `errors: [{ path: field }]`). */
  async getRow(id: string, field?: string): Promise<Vehicle> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!row) throw field ? AppException.notFoundField(field) : AppException.notFound();
    return row;
  }

  /** The open inventory cycle of a vehicle (at most one). */
  openCycle(vehicleId: string, tx: Tx = this.prisma): Promise<InventoryCycle | null> {
    return tx.inventoryCycle.findFirst({
      where: { vehicleId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  async hasOpenSegment(vehicleId: string, tx: Tx = this.prisma): Promise<boolean> {
    return (await tx.leaseSegment.count({ where: { vehicleId, endDate: null } })) > 0;
  }

  /* ------------------------------------------------------------------------------------ */
  /* Writes                                                                               */
  /* ------------------------------------------------------------------------------------ */

  /**
   * Creates a vehicle. OWNED cars in stock (IN_STOCK / RESERVED / LEASED) get an OWNED
   * inventory cycle starting today (purchase deals arrive with the Deals module).
   */
  async create(dto: VehicleCreate): Promise<VehicleDetail> {
    await this.assertUnique(dto.plateNo, dto.vin ?? null);
    const ownerDriverId = dto.ownership === 'THIRD_PARTY' ? (dto.ownerDriverId ?? null) : null;
    if (ownerDriverId) await this.assertDriver(ownerDriverId);
    const today = this.clock.today();
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.create({
          data: {
            plateNo: dto.plateNo,
            vin: dto.vin ?? null,
            make: dto.make,
            model: dto.model,
            trim: dto.trim ?? null,
            year: dto.year,
            color: dto.color ?? null,
            fuel: dto.fuel ?? null,
            gearbox: dto.gearbox ?? null,
            engineCc: dto.engineCc ?? null,
            hand: dto.hand ?? null,
            isTaxi: dto.isTaxi,
            status: dto.status,
            ownership: dto.ownership,
            ownerDriverId,
            currentKm: dto.currentKm ?? null,
            registrationExpiry: dto.registrationExpiry ? dbDate(dto.registrationExpiry) : null,
            dealerRegisteredAt: dto.dealerRegisteredAt ? dbDate(dto.dealerRegisteredAt) : null,
            meterSerial: dto.meterSerial ?? null,
            meterSealedAt: dto.meterSealedAt ? dbDate(dto.meterSealedAt) : null,
            location: dto.location ?? null,
            listingPrice: toDbMoneyOrNull(dto.listingPrice),
            notes: dto.notes ?? null,
          },
        });
        if (dto.ownership === 'OWNED' && STOCK_STATUSES.has(dto.status)) {
          await this.openOwnedCycle(tx, v.id, today, v.listingPrice);
        }
        return v.id;
      });
    } catch (e) {
      rethrowUnique(e);
    }
    return this.get(id);
  }

  /**
   * Partial update. Status changes go through `changeStatus`. Ownership: CONSIGNED only via
   * `POST /vehicles/:id/consign`; other ownership changes need no open cycle, and switching to
   * OWNED while in stock opens an OWNED cycle.
   */
  async update(id: string, dto: VehicleUpdate): Promise<VehicleDetail> {
    const current = await this.getRow(id);
    if (dto.plateNo !== undefined && dto.plateNo !== current.plateNo) {
      await this.assertUnique(dto.plateNo, null, id);
    }
    if (dto.vin && dto.vin !== current.vin) await this.assertUnique(null, dto.vin, id);

    const ownership = dto.ownership ?? current.ownership;
    const ownershipChanged = ownership !== current.ownership;
    if (ownershipChanged) {
      if (ownership === 'CONSIGNED') throw AppException.conflict(ErrorKey.invalidTransition);
      if (await this.openCycle(id)) throw AppException.conflict(ErrorKey.cycleOpen);
    }
    let ownerDriverId = dto.ownerDriverId !== undefined ? dto.ownerDriverId : current.ownerDriverId;
    if (ownership !== 'THIRD_PARTY') ownerDriverId = null;
    else if (!ownerDriverId)
      throw AppException.fieldError('ownerDriverId', msg.ownerDriverRequired);
    else if (ownerDriverId !== current.ownerDriverId) await this.assertDriver(ownerDriverId);

    const today = this.clock.today();
    try {
      await this.prisma.$transaction(async (tx) => {
        const v = await tx.vehicle.update({
          where: { id },
          data: {
            plateNo: dto.plateNo,
            vin: dto.vin,
            make: dto.make,
            model: dto.model,
            trim: dto.trim,
            year: dto.year,
            color: dto.color,
            fuel: dto.fuel,
            gearbox: dto.gearbox,
            engineCc: dto.engineCc,
            hand: dto.hand,
            isTaxi: dto.isTaxi,
            ownership,
            ownerDriverId,
            currentKm: dto.currentKm,
            registrationExpiry: dbDateOpt(dto.registrationExpiry),
            dealerRegisteredAt: dbDateOpt(dto.dealerRegisteredAt),
            meterSerial: dto.meterSerial,
            meterSealedAt: dbDateOpt(dto.meterSealedAt),
            location: dto.location,
            listingPrice:
              dto.listingPrice === undefined ? undefined : toDbMoneyOrNull(dto.listingPrice),
            notes: dto.notes,
          },
        });
        if (ownershipChanged && ownership === 'OWNED' && STOCK_STATUSES.has(v.status)) {
          await this.openOwnedCycle(tx, id, today, v.listingPrice);
        }
      });
    } catch (e) {
      rethrowUnique(e);
    }
    return this.get(id);
  }

  /** Manual status change (see `checkStatusTransition`); audited with the optional note. */
  async changeStatus(
    id: string,
    dto: VehicleStatusChange,
    userId: string | null,
  ): Promise<VehicleDetail> {
    const before = await this.getRow(id);
    const hasOpenSegment = before.status === 'LEASED' ? await this.hasOpenSegment(id) : false;
    const result = checkStatusTransition(before.status, dto.status, { hasOpenSegment });
    if (!result.ok) throw AppException.conflict(result.error);
    if (result.noop) return this.get(id);
    if (before.status === 'RESERVED') {
      // A car reserved by a draft / pending sale is released by cancelling that deal.
      const pendingSales = await this.prisma.deal.count({
        where: {
          vehicleId: id,
          type: { in: ['SALE', 'CONSIGNMENT_SALE'] },
          status: { in: ['DRAFT', 'PENDING'] },
        },
      });
      if (pendingSales > 0) throw AppException.conflict(ErrorKey.dealPending);
    }

    const today = this.clock.today();
    const after = await this.prisma.$transaction(async (tx) => {
      const open = await this.openCycle(id, tx);
      const data: Prisma.VehicleUncheckedUpdateInput = { status: dto.status };
      if (result.effect === 'openOwnedCycle') {
        data.ownership = 'OWNED';
        data.ownerDriverId = null;
        if (!open) await this.openOwnedCycle(tx, id, today, before.listingPrice);
      }
      if (result.effect === 'closeCycleScrapped' && open) {
        await this.closeCycle(tx, open, today, 'SCRAPPED');
      }
      return tx.vehicle.update({ where: { id }, data });
    });
    await this.audit.record({
      userId,
      entity: 'Vehicle',
      entityId: id,
      action: AuditAction.UPDATE,
      before,
      after: dto.note ? { ...after, statusNote: dto.note } : after,
    });
    return this.get(id);
  }

  /** Opens an OWNED cycle starting `startedAt` (asking price = listing price). */
  async openOwnedCycle(
    tx: Tx,
    vehicleId: string,
    startedAt: string,
    askingPrice: Prisma.Decimal | null,
  ): Promise<InventoryCycle> {
    return tx.inventoryCycle.create({
      data: { vehicleId, kind: 'OWNED', startedAt: dbDate(startedAt), askingPrice },
    });
  }

  /** Ends a cycle on `date` (never before its start). */
  async closeCycle(
    tx: Tx,
    cycle: InventoryCycle,
    date: string,
    reason: 'SOLD' | 'RETURNED_TO_CONSIGNOR' | 'SCRAPPED' | 'CANCELLED',
  ): Promise<InventoryCycle> {
    const start = isoOf(cycle.startedAt);
    return tx.inventoryCycle.update({
      where: { id: cycle.id },
      data: { endedAt: dbDate(date < start ? start : date), endReason: reason },
    });
  }

  /* ------------------------------------------------------------------------------------ */
  /* Helpers                                                                              */
  /* ------------------------------------------------------------------------------------ */

  /** `Settings.reminderLeadDays.registration` (defaults when the row does not exist yet). */
  async registrationLeadDays(): Promise<number> {
    const row = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: { reminderLeadDays: true },
    });
    const parsed = ReminderLeadDaysSchema.safeParse(row?.reminderLeadDays ?? {});
    return parsed.success ? parsed.data.registration : DEFAULT_REMINDER_LEAD_DAYS.registration;
  }

  toListItem(row: VehicleWithRefs, today: string, leadDays: number): VehicleListItem {
    const base = toListItemBase(row);
    return {
      ...base,
      alerts: vehicleAlerts(
        {
          year: row.year,
          isTaxi: row.isTaxi,
          status: row.status,
          registrationExpiry: isoOrNull(row.registrationExpiry),
          dealerRegisteredAt: isoOrNull(row.dealerRegisteredAt),
        },
        today,
        leadDays,
      ),
    };
  }

  private async assertUnique(plateNo: string | null, vin: string | null, exceptId?: string) {
    const not = exceptId ? { id: { not: exceptId } } : {};
    if (plateNo) {
      const other = await this.prisma.vehicle.findFirst({
        where: { plateNo, ...not },
        select: { id: true },
      });
      if (other) throw AppException.duplicate('plateNo');
    }
    if (vin) {
      const other = await this.prisma.vehicle.findFirst({
        where: { vin, ...not },
        select: { id: true },
      });
      if (other) throw AppException.duplicate('vin');
    }
  }

  private async assertDriver(driverId: string) {
    const found = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!found) throw AppException.notFoundField('ownerDriverId');
  }

  private buildWhere(
    query: VehicleSummaryQuery & { status?: VehicleQuery['status'] },
  ): Prisma.VehicleWhereInput {
    const and: Prisma.VehicleWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.ownership?.length) and.push({ ownership: { in: query.ownership } });
    if (query.isTaxi !== undefined) and.push({ isTaxi: query.isTaxi });
    if (query.make) and.push({ make: { equals: query.make, mode: 'insensitive' } });
    if (query.yearFrom !== undefined || query.yearTo !== undefined) {
      let from = query.yearFrom;
      let to = query.yearTo;
      if (from !== undefined && to !== undefined && from > to) [from, to] = [to, from];
      and.push({ year: { gte: from, lte: to } });
    }
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.VehicleWhereInput[] = [
        { make: text },
        { model: text },
        { trim: text },
        { vin: { contains: token.replace(/[\s-]/g, '').toUpperCase() } },
      ];
      const plate = normalizePlate(token);
      if (/^\d{2,8}$/.test(plate)) or.push({ plateNo: { contains: plate } });
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
