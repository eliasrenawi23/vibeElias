import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { msg, type Consign, type CycleReturn } from '@renawi/shared';
import { AuditService } from '../common/audit/audit.service';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { ContactsService } from '../contacts/contacts.service';
import { toDbMoney, toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import { CycleView, VehicleDetail } from './vehicle-views';
import { VehiclesService } from './vehicles.service';

/** Inventory cycles: listing, consignment intake and return to the consignor. */
@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly contacts: ContactsService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  async list(vehicleId: string): Promise<CycleView[]> {
    await this.vehicles.getRow(vehicleId);
    return this.vehicles.cycleViews(vehicleId);
  }

  /**
   * Consignment intake: needs no open cycle and no open lease segment. Opens a CONSIGNED cycle,
   * makes the vehicle CONSIGNED / IN_STOCK (listing price = asking price) and tags the
   * consignor contact with CONSIGNOR.
   */
  async consign(vehicleId: string, dto: Consign, userId: string | null): Promise<VehicleDetail> {
    await this.vehicles.getRow(vehicleId);
    if (await this.vehicles.openCycle(vehicleId)) throw AppException.conflict(ErrorKey.cycleOpen);
    if (await this.vehicles.hasOpenSegment(vehicleId)) {
      throw AppException.conflict(ErrorKey.vehicleLeased);
    }
    await this.contacts.assertExists(dto.consignorId, 'consignorId');
    const startedAt = dto.startedAt ?? this.clock.today();
    if (dto.agreementEndsAt && dto.agreementEndsAt < startedAt) {
      throw AppException.fieldError('agreementEndsAt', msg.endBeforeStart);
    }

    const cycle = await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction (the partial unique index is the final guard).
      if (await this.vehicles.openCycle(vehicleId, tx)) {
        throw AppException.conflict(ErrorKey.cycleOpen);
      }
      const created = await tx.inventoryCycle.create({
        data: {
          vehicleId,
          kind: 'CONSIGNED',
          startedAt: dbDate(startedAt),
          consignorId: dto.consignorId,
          askingPrice: toDbMoney(dto.askingPrice),
          minNetToConsignor: toDbMoneyOrNull(dto.minNetToConsignor),
          commissionMode: dto.commissionMode,
          // SURPLUS keeps everything above the minimum net: no commission value.
          commissionValue:
            dto.commissionMode === 'SURPLUS' ? null : toDbMoneyOrNull(dto.commissionValue),
          agreementEndsAt: dto.agreementEndsAt ? dbDate(dto.agreementEndsAt) : null,
        },
      });
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          ownership: 'CONSIGNED',
          status: 'IN_STOCK',
          ownerDriverId: null,
          listingPrice: toDbMoney(dto.askingPrice),
        },
      });
      return created;
    });
    await this.audit.record({
      userId,
      entity: 'InventoryCycle',
      entityId: cycle.id,
      action: AuditAction.CREATE,
      after: cycle,
    });
    await this.contacts.addTag(dto.consignorId, 'CONSIGNOR', userId);
    return this.vehicles.get(vehicleId);
  }

  /**
   * Ends an open CONSIGNED cycle with RETURNED_TO_CONSIGNOR; the vehicle becomes RETURNED and
   * stays CONSIGNED. Blocked while a draft / pending deal is attached to the cycle.
   */
  async returnToConsignor(
    cycleId: string,
    dto: CycleReturn,
    userId: string | null,
  ): Promise<VehicleDetail> {
    const cycle = await this.prisma.inventoryCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw AppException.notFound();
    if (cycle.endedAt) throw AppException.conflict(ErrorKey.noOpenCycle);
    if (cycle.kind !== 'CONSIGNED') throw AppException.conflict(ErrorKey.invalidTransition);
    const pendingDeals = await this.prisma.deal.count({
      where: { cycleId, status: { in: ['DRAFT', 'PENDING'] } },
    });
    if (pendingDeals > 0) throw AppException.conflict(ErrorKey.dealPending);
    const date = dto.date ?? this.clock.today();
    if (date < isoOf(cycle.startedAt)) throw AppException.fieldError('date', msg.endBeforeStart);

    const before = await this.vehicles.getRow(cycle.vehicleId);
    const after = await this.prisma.$transaction(async (tx) => {
      await tx.inventoryCycle.update({
        where: { id: cycleId },
        data: { endedAt: dbDate(date), endReason: 'RETURNED_TO_CONSIGNOR' },
      });
      return tx.vehicle.update({ where: { id: cycle.vehicleId }, data: { status: 'RETURNED' } });
    });
    const note = dto.notes ?? dto.note;
    await this.audit.record({
      userId,
      entity: 'Vehicle',
      entityId: cycle.vehicleId,
      action: AuditAction.UPDATE,
      before,
      after: note ? { ...after, returnNote: note } : after,
    });
    return this.vehicles.get(cycle.vehicleId);
  }
}
