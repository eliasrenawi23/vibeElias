import { Injectable } from '@nestjs/common';
import { Prisma, TrafficFine } from '@prisma/client';
import {
  addDays,
  contactDisplayName,
  fineReassignDeadline,
  normalizePlate,
  toBusinessDate,
  type FineAlert,
  type FineCreate,
  type FineQuery,
  type FineSummary,
  type FineSummaryQuery,
  FineStatus,
  type FineRebill,
  type FineUpdate,
  type Paginated,
} from '@renawi/shared';
import { Clock } from '../common/clock';
import { dbDate, dbDateOpt, isoOf, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { CONTACT_NAME_SELECT, NamedRef, searchTokens } from '../common/refs';
import { LedgerService } from '../ledger/ledger.service';
import { toDbMoney } from '../prisma/prisma.decimal';
import { zeroCounts } from '../common/status-counts';
import { PrismaService } from '../prisma/prisma.service';

/** Days before the reassignment deadline at which a NEW fine is flagged. */
export const FINE_DUE_SOON_DAYS = 14;

const FINE_INCLUDE = {
  vehicle: { select: { id: true, plateNo: true } },
  driver: { select: { id: true, contact: { select: CONTACT_NAME_SELECT } } },
  contract: { select: { id: true, contractNo: true } },
} satisfies Prisma.TrafficFineInclude;
type FineWithRefs = Prisma.TrafficFineGetPayload<{ include: typeof FINE_INCLUDE }>;

/** `GET /fines` item / `GET /fines/:id` (also returned by every fine mutation). */
export interface FineView extends TrafficFine {
  vehicle: { id: string; plateNo: string };
  driver: NamedRef | null;
  contract: { id: string; contractNo: number } | null;
  alerts: FineAlert[];
}

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'offenceAt',
  'receivedAt',
  'reassignDeadline',
  'amount',
  'status',
]);

/** Reassignment alerts of a NEW fine (the deadline is what matters until it is submitted). */
export function fineAlerts(
  status: FineStatus,
  reassignDeadline: string | null,
  today: string,
): FineAlert[] {
  if (status !== 'NEW' || !reassignDeadline) return [];
  if (reassignDeadline < today) return ['reassignOverdue'];
  if (reassignDeadline <= addDays(today, FINE_DUE_SOON_DAYS)) return ['reassignDueSoon'];
  return [];
}

@Injectable()
export class FinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly ledger: LedgerService,
  ) {}

  /** Count per status under the list filters, ignoring `status` (one groupBy). */
  async summary(query: FineSummaryQuery): Promise<FineSummary> {
    const rows = await this.prisma.trafficFine.groupBy({
      by: ['status'],
      where: this.buildWhere({ ...query, status: undefined }),
      _count: { _all: true },
    });
    const counts = zeroCounts(FineStatus.options);
    for (const r of rows) counts[r.status] = r._count._all;
    return { counts };
  }

  async list(query: FineQuery): Promise<Paginated<FineView>> {
    const where = this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'offenceAt';
    const orderBy: Prisma.TrafficFineOrderByWithRelationInput[] = [
      sort === 'reassignDeadline'
        ? { reassignDeadline: { sort: query.order, nulls: 'last' } }
        : { [sort]: query.order },
      { id: 'asc' },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.trafficFine.count({ where }),
      this.prisma.trafficFine.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: FINE_INCLUDE,
      }),
    ]);
    const today = this.clock.today();
    return {
      items: rows.map((r) => this.toView(r, today)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<FineView> {
    const row = await this.prisma.trafficFine.findUnique({ where: { id }, include: FINE_INCLUDE });
    if (!row) throw AppException.notFound();
    return this.toView(row, this.clock.today());
  }

  /**
   * Records a fine. Without an explicit driver it is matched to the driver of the (non-draft)
   * lease segment that held the car on the offence date; the reassignment deadline defaults to
   * `receivedAt + 90 days`.
   */
  async create(dto: FineCreate): Promise<FineView> {
    await this.assertVehicle(dto.vehicleId);
    const match =
      dto.driverId !== undefined
        ? await this.explicitMatch(dto.driverId ?? null, dto.contractId ?? null)
        : await this.matchDriver(dto.vehicleId, dto.offenceAt);
    const row = await this.prisma.trafficFine.create({
      data: {
        vehicleId: dto.vehicleId,
        driverId: match.driverId,
        contractId: match.contractId,
        fineNo: dto.fineNo ?? null,
        authority: dto.authority ?? null,
        offenceAt: new Date(dto.offenceAt),
        receivedAt: dbDate(dto.receivedAt),
        amount: toDbMoney(dto.amount),
        status: dto.status,
        reassignDeadline: dbDate(dto.reassignDeadline ?? fineReassignDeadline(dto.receivedAt)),
        notes: dto.notes ?? null,
      },
      select: { id: true },
    });
    return this.get(row.id);
  }

  async update(id: string, dto: FineUpdate): Promise<FineView> {
    const current = await this.getRow(id);
    if (
      current.chargeEntryId &&
      dto.amount !== undefined &&
      !toDbMoney(dto.amount).equals(current.amount)
    ) {
      throw AppException.conflict(ErrorKey.alreadyRebilled);
    }
    const vehicleId = dto.vehicleId ?? current.vehicleId;
    if (dto.vehicleId && dto.vehicleId !== current.vehicleId) await this.assertVehicle(vehicleId);
    const offenceAt = dto.offenceAt ?? current.offenceAt.toISOString();
    let match: { driverId: string | null; contractId: string | null } | undefined;
    if (dto.driverId !== undefined || dto.contractId !== undefined) {
      match = await this.explicitMatch(
        dto.driverId !== undefined ? dto.driverId : current.driverId,
        dto.contractId !== undefined ? dto.contractId : current.contractId,
      );
    } else if (
      vehicleId !== current.vehicleId ||
      new Date(offenceAt).getTime() !== current.offenceAt.getTime()
    ) {
      match = await this.matchDriver(vehicleId, offenceAt);
    }
    const receivedChanged =
      dto.receivedAt !== undefined && dto.receivedAt !== isoOf(current.receivedAt);
    await this.prisma.trafficFine.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
        driverId: match?.driverId,
        contractId: match?.contractId,
        fineNo: dto.fineNo,
        authority: dto.authority,
        offenceAt: dto.offenceAt ? new Date(dto.offenceAt) : undefined,
        receivedAt: dto.receivedAt ? dbDate(dto.receivedAt) : undefined,
        amount: dto.amount === undefined ? undefined : toDbMoney(dto.amount),
        status: dto.status,
        reassignDeadline:
          dto.reassignDeadline !== undefined
            ? dbDateOpt(dto.reassignDeadline)
            : receivedChanged && dto.receivedAt
              ? dbDate(fineReassignDeadline(dto.receivedAt))
              : undefined,
        notes: dto.notes,
      },
    });
    return this.get(id);
  }

  /**
   * We paid the fine and pass it on: a VehicleExpense (FINE, paid by US) on the car and a
   * CHARGE (FINE) on the driver, linked through `chargeEntryId`; status PAID_BY_US.
   */
  async rebill(id: string, dto: FineRebill, userId: string | null): Promise<FineView> {
    const fine = await this.getRow(id);
    if (fine.chargeEntryId) throw AppException.conflict(ErrorKey.alreadyRebilled);
    const driverId = dto.driverId ?? fine.driverId;
    if (!driverId) throw AppException.conflict(ErrorKey.fineNoDriver);
    if (dto.driverId) await this.assertDriver(dto.driverId);
    const date = dto.date ?? this.clock.today();
    const contract =
      fine.contractId && driverId === fine.driverId
        ? await this.prisma.leaseContract.findUnique({
            where: { id: fine.contractId },
            select: {
              id: true,
              segments: {
                orderBy: { startDate: 'desc' },
                take: 1,
                select: { taxiLicenseId: true },
              },
            },
          })
        : null;
    const description =
      dto.description ?? [fine.fineNo, fine.authority].filter(Boolean).join(' · ');
    await this.prisma.$transaction(async (tx) => {
      const charge = await this.ledger.createEntry(tx, {
        driverId,
        contractId: contract?.id ?? null,
        type: 'CHARGE',
        chargeKind: 'FINE',
        date,
        dueDate: dto.dueDate ?? date,
        amount: dto.amount ?? fine.amount,
        reference: fine.fineNo,
        description: description || null,
        vehicleId: fine.vehicleId,
        taxiLicenseId: contract?.segments[0]?.taxiLicenseId ?? null,
        userId,
      });
      const cycle = await tx.inventoryCycle.findFirst({
        where: { vehicleId: fine.vehicleId, endedAt: null },
        select: { id: true },
      });
      await tx.vehicleExpense.create({
        data: {
          vehicleId: fine.vehicleId,
          cycleId: cycle?.id ?? null,
          category: 'FINE',
          date: dbDate(date),
          amount: fine.amount,
          paidBy: 'US',
          rebilledEntryId: charge.id,
          description: description || null,
        },
      });
      await tx.trafficFine.update({
        where: { id },
        data: { status: 'PAID_BY_US', chargeEntryId: charge.id, driverId },
      });
      await this.ledger.reallocateDriver(tx, driverId);
    });
    return this.get(id);
  }

  /* ------------------------------------------------------------------------------------ */

  private async getRow(id: string): Promise<TrafficFine> {
    const row = await this.prisma.trafficFine.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return row;
  }

  private toView(row: FineWithRefs, today: string): FineView {
    const { vehicle, driver, contract, ...fine } = row;
    return {
      ...fine,
      vehicle,
      driver: driver ? { id: driver.id, name: contactDisplayName(driver.contact) } : null,
      contract: contract ?? null,
      alerts: fineAlerts(fine.status, isoOrNull(fine.reassignDeadline), today),
    };
  }

  /**
   * Driver / contract of the lease segment holding the car on the offence date (business time
   * zone); DRAFT contracts do not count.
   */
  async matchDriver(
    vehicleId: string,
    offenceAt: string,
  ): Promise<{ driverId: string | null; contractId: string | null }> {
    const day = dbDate(toBusinessDate(offenceAt, this.clock.timeZone));
    const segment = await this.prisma.leaseSegment.findFirst({
      where: {
        vehicleId,
        startDate: { lte: day },
        OR: [{ endDate: null }, { endDate: { gte: day } }],
        contract: { status: { not: 'DRAFT' } },
      },
      orderBy: { startDate: 'desc' },
      select: { contract: { select: { id: true, driverId: true } } },
    });
    return {
      driverId: segment?.contract.driverId ?? null,
      contractId: segment?.contract.id ?? null,
    };
  }

  private async explicitMatch(
    driverId: string | null,
    contractId: string | null,
  ): Promise<{ driverId: string | null; contractId: string | null }> {
    if (driverId) await this.assertDriver(driverId);
    if (contractId) {
      const contract = await this.prisma.leaseContract.findUnique({
        where: { id: contractId },
        select: { driverId: true },
      });
      if (!contract) throw AppException.notFoundField('contractId');
      return { driverId: driverId ?? contract.driverId, contractId };
    }
    return { driverId, contractId: null };
  }

  private async assertVehicle(vehicleId: string): Promise<void> {
    const found = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!found) throw AppException.notFoundField('vehicleId');
  }

  private async assertDriver(driverId: string): Promise<void> {
    const found = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!found) throw AppException.notFoundField('driverId');
  }

  private buildWhere(
    query: FineSummaryQuery & { status?: FineQuery['status'] },
  ): Prisma.TrafficFineWhereInput {
    const and: Prisma.TrafficFineWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.vehicleId) and.push({ vehicleId: query.vehicleId });
    if (query.driverId) and.push({ driverId: query.driverId });
    if (query.deadlineBefore) {
      and.push({ reassignDeadline: { lte: dbDate(query.deadlineBefore) } });
    }
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.TrafficFineWhereInput[] = [
        { fineNo: text },
        { authority: text },
        { driver: { contact: { firstName: text } } },
        { driver: { contact: { lastName: text } } },
      ];
      const plate = normalizePlate(token);
      if (/^\d{2,8}$/.test(plate)) or.push({ vehicle: { plateNo: { contains: plate } } });
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
