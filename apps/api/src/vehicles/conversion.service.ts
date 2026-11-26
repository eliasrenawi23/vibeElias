import { Injectable } from '@nestjs/common';
import { AuditAction, InventoryCycle, Prisma, VehicleExpense } from '@prisma/client';
import type { VehicleConversionUpdate, VehicleConvert } from '@renawi/shared';
import { AuditRecord, AuditService } from '../common/audit/audit.service';
import { Clock } from '../common/clock';
import { dbDate, isoOf, isoOrNull } from '../common/dates';
import { AppException, ErrorKey, FieldError } from '../common/errors/app-exception';
import { DocumentsService } from '../documents/documents.service';
import { toDbMoney, toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import {
  conversionAuditSummary,
  conversionBlockers,
  conversionDateError,
  conversionExpenseDescription,
  convertedListingPrice,
  CycleBounds,
  newPlateError,
} from './conversion-rules';
import { VehicleDetail } from './vehicle-views';
import { VehiclesService } from './vehicles.service';

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { timeout: 20_000, maxWait: 10_000 } as const;
const ZERO = new Prisma.Decimal(0);

/** Cycles that count (a CANCELLED cycle never happened). */
const NOT_CANCELLED: Prisma.InventoryCycleWhereInput = {
  OR: [{ endReason: null }, { endReason: { not: 'CANCELLED' } }],
};

function boundsOf(cycle: InventoryCycle | null): CycleBounds | null {
  return cycle ? { startedAt: isoOf(cycle.startedAt), endedAt: isoOrNull(cycle.endedAt) } : null;
}

/** A unique violation on the plate while writing = the new plate was taken meanwhile. */
function rethrowPlateConflict(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw AppException.duplicate('newPlateNo');
  }
  throw e;
}

/**
 * Taxi -> private conversion: the car gets a private plate (the taxi plate is kept in
 * `VehiclePlateChange` and retired), stops being a taxi, and the customs paid become a
 * CONVERSION_TAX expense of the open inventory cycle. One-way; `updateConversion` corrects it.
 */
@Injectable()
export class ConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly vehicles: VehiclesService,
    private readonly documents: DocumentsService,
  ) {}

  /** `POST /vehicles/:id/convert-to-private`. */
  async convert(id: string, dto: VehicleConvert, userId: string | null): Promise<VehicleDetail> {
    const row = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { registeredLicense: { select: { id: true } } },
    });
    if (!row) throw AppException.notFound();
    const { registeredLicense, ...before } = row;
    const blockers = conversionBlockers({
      isTaxi: before.isTaxi,
      ownership: before.ownership,
      status: before.status,
      hasOpenSegment: await this.vehicles.hasOpenSegment(id),
      hasRegisteredLicense: registeredLicense !== null,
    });
    if (blockers[0]) throw AppException.conflict(blockers[0]);

    const open = await this.vehicles.openCycle(id);
    const errors: FieldError[] = [];
    const plateError = newPlateError(dto.newPlateNo, before.plateNo);
    if (plateError) errors.push({ path: 'newPlateNo', message: plateError });
    const dateError = conversionDateError(dto.convertedAt, this.clock.today(), boundsOf(open));
    if (dateError) errors.push({ path: 'convertedAt', message: dateError });
    if (errors.length) throw AppException.badRequest(ErrorKey.validation, errors);
    await this.assertPlateFree(dto.newPlateNo, id);

    const tax = toDbMoney(dto.conversionTax);
    const paid = tax.greaterThan(0);
    const vendorId = paid ? (dto.vendorId ?? null) : null;
    if (vendorId) await this.assertVendor(vendorId);
    const listingPrice = convertedListingPrice(
      before.listingPrice,
      dto.conversionTax,
      dto.listingPrice,
    );

    const audits: AuditRecord[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        const expense = paid
          ? await tx.vehicleExpense.create({
              data: {
                vehicleId: id,
                cycleId: open?.id ?? null,
                category: 'CONVERSION_TAX',
                date: dbDate(dto.convertedAt),
                amount: tax,
                vatIncluded: false,
                vatReclaimable: false,
                paidBy: 'US',
                vendorId,
                description: conversionExpenseDescription(before.plateNo, dto.newPlateNo),
              },
            })
          : null;
        await tx.vehiclePlateChange.create({
          data: {
            vehicleId: id,
            oldPlateNo: before.plateNo,
            newPlateNo: dto.newPlateNo,
            changedAt: dbDate(dto.convertedAt),
            reason: 'TAXI_TO_PRIVATE',
            conversionTax: tax,
            expenseId: expense?.id ?? null,
            notes: dto.notes ?? null,
            createdById: userId,
          },
        });
        // Guarded against a concurrent conversion of the same car.
        const updated = await tx.vehicle.updateMany({
          where: { id, isTaxi: true, convertedAt: null },
          data: {
            plateNo: dto.newPlateNo,
            isTaxi: false,
            convertedAt: dbDate(dto.convertedAt),
            meterSerial: null,
            meterSealedAt: null,
            expectedConversionTax: null,
            listingPrice: toDbMoneyOrNull(listingPrice),
          },
        });
        if (updated.count === 0) throw AppException.conflict(ErrorKey.vehicleNotTaxi);
        const after = await tx.vehicle.findUniqueOrThrow({ where: { id } });
        audits.push({
          entity: 'Vehicle',
          entityId: id,
          action: AuditAction.UPDATE,
          before,
          after: { ...after, summary: conversionAuditSummary(before.plateNo, dto.newPlateNo) },
        });
        if (expense) {
          audits.push({
            entity: 'VehicleExpense',
            entityId: expense.id,
            action: AuditAction.CREATE,
            after: expense,
          });
        }
      }, TX_OPTIONS);
    } catch (e) {
      rethrowPlateConflict(e);
    }
    for (const a of audits) await this.audit.record({ ...a, userId });
    return this.vehicles.get(id);
  }

  /**
   * `PATCH /vehicles/:id/conversion`: corrects the latest TAXI_TO_PRIVATE change (date, new
   * plate, customs, notes). The vehicle's plate and `convertedAt` and the linked customs expense
   * (amount, date, description; created / deleted when the customs move from / to 0) follow.
   * 404 when the vehicle was never converted.
   */
  async updateConversion(
    id: string,
    dto: VehicleConversionUpdate,
    userId: string | null,
  ): Promise<VehicleDetail> {
    const before = await this.vehicles.getRow(id);
    const change = await this.prisma.vehiclePlateChange.findFirst({
      where: { vehicleId: id, reason: 'TAXI_TO_PRIVATE' },
      orderBy: [{ changedAt: 'desc' }, { createdAt: 'desc' }],
      include: { expense: true },
    });
    if (!change) throw AppException.notFound();

    const oldDate = isoOf(change.changedAt);
    const convertedAt = dto.convertedAt ?? oldDate;
    const newPlateNo = dto.newPlateNo ?? change.newPlateNo;
    const plateChanged = newPlateNo !== change.newPlateNo;
    const expense = change.expense;
    const cycle = expense?.cycleId
      ? await this.prisma.inventoryCycle.findUnique({ where: { id: expense.cycleId } })
      : await this.cycleOn(id, oldDate);

    const errors: FieldError[] = [];
    if (plateChanged) {
      const plateError = newPlateError(newPlateNo, change.oldPlateNo);
      if (plateError) errors.push({ path: 'newPlateNo', message: plateError });
    }
    if (convertedAt !== oldDate) {
      const dateError = conversionDateError(convertedAt, this.clock.today(), boundsOf(cycle));
      if (dateError) errors.push({ path: 'convertedAt', message: dateError });
    }
    if (errors.length) throw AppException.badRequest(ErrorKey.validation, errors);
    if (plateChanged) await this.assertPlateFree(newPlateNo, id);

    // Not sent: the linked expense is the cost record (it may have been edited directly).
    const tax =
      dto.conversionTax === undefined
        ? (expense?.amount ?? change.conversionTax ?? ZERO)
        : toDbMoney(dto.conversionTax);
    const paid = tax.greaterThan(0);
    if (
      expense?.rebilledEntryId &&
      (!paid || !tax.equals(expense.amount) || convertedAt !== isoOf(expense.date))
    ) {
      throw AppException.conflict(ErrorKey.expenseRebilled);
    }
    const description = conversionExpenseDescription(change.oldPlateNo, newPlateNo);
    const removedDocs =
      expense && !paid
        ? await this.prisma.document.findMany({
            where: { expenseId: expense.id },
            select: { fileKey: true, hasThumb: true },
          })
        : [];

    const audits: AuditRecord[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        const expenseId = await this.syncExpense(tx, {
          vehicleId: id,
          expense,
          cycleId: cycle?.id ?? null,
          tax,
          date: convertedAt,
          description,
          audits,
        });
        await tx.vehiclePlateChange.update({
          where: { id: change.id },
          data: {
            newPlateNo,
            changedAt: dbDate(convertedAt),
            conversionTax: tax,
            expenseId,
            notes: dto.notes,
          },
        });
        if (expense && !paid) await tx.vehicleExpense.delete({ where: { id: expense.id } });
        const after = await tx.vehicle.update({
          where: { id },
          data: {
            // The plate follows only while the car still carries the corrected one.
            plateNo: plateChanged && before.plateNo === change.newPlateNo ? newPlateNo : undefined,
            convertedAt: dbDate(convertedAt),
          },
        });
        audits.unshift({
          entity: 'Vehicle',
          entityId: id,
          action: AuditAction.UPDATE,
          before,
          after: { ...after, summary: conversionAuditSummary(change.oldPlateNo, newPlateNo, true) },
        });
      }, TX_OPTIONS);
    } catch (e) {
      rethrowPlateConflict(e);
    }
    await this.documents.removeFiles(removedDocs);
    for (const a of audits) await this.audit.record({ ...a, userId });
    return this.vehicles.get(id);
  }

  /**
   * Keeps the customs expense in line with the corrected conversion and returns the id to link:
   * updated (amount, date, description) or created while the customs are > 0, unlinked (the
   * caller deletes it) at 0.
   */
  private async syncExpense(
    tx: Tx,
    p: {
      vehicleId: string;
      expense: VehicleExpense | null;
      cycleId: string | null;
      tax: Prisma.Decimal;
      date: string;
      description: string;
      audits: AuditRecord[];
    },
  ): Promise<string | null> {
    const { expense } = p;
    if (!p.tax.greaterThan(0)) {
      if (expense) {
        p.audits.push({
          entity: 'VehicleExpense',
          entityId: expense.id,
          action: AuditAction.DELETE,
          before: expense,
        });
      }
      return null;
    }
    if (expense) {
      const updated = await tx.vehicleExpense.update({
        where: { id: expense.id },
        data: { amount: p.tax, date: dbDate(p.date), description: p.description },
      });
      p.audits.push({
        entity: 'VehicleExpense',
        entityId: expense.id,
        action: AuditAction.UPDATE,
        before: expense,
        after: updated,
      });
      return expense.id;
    }
    const created = await tx.vehicleExpense.create({
      data: {
        vehicleId: p.vehicleId,
        cycleId: p.cycleId,
        category: 'CONVERSION_TAX',
        date: dbDate(p.date),
        amount: p.tax,
        vatIncluded: false,
        vatReclaimable: false,
        paidBy: 'US',
        description: p.description,
      },
    });
    p.audits.push({
      entity: 'VehicleExpense',
      entityId: created.id,
      action: AuditAction.CREATE,
      after: created,
    });
    return created.id;
  }

  /**
   * 409 `validation.duplicate` on `newPlateNo` when another vehicle carries the plate or any
   * vehicle had it before (old plates are retired).
   */
  private async assertPlateFree(plateNo: string, vehicleId: string): Promise<void> {
    const [other, retired] = await Promise.all([
      this.prisma.vehicle.findFirst({
        where: { plateNo, id: { not: vehicleId } },
        select: { id: true },
      }),
      this.vehicles.isRetiredPlate(plateNo),
    ]);
    if (other || retired) throw AppException.duplicate('newPlateNo');
  }

  private async assertVendor(vendorId: string): Promise<void> {
    const found = await this.prisma.contact.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!found) throw AppException.notFoundField('vendorId');
  }

  /** The (non-cancelled) cycle of the vehicle that covers `date`, the latest one first. */
  private cycleOn(vehicleId: string, date: string): Promise<InventoryCycle | null> {
    const day = dbDate(date);
    return this.prisma.inventoryCycle.findFirst({
      where: {
        AND: [
          NOT_CANCELLED,
          { vehicleId, startedAt: { lte: day } },
          { OR: [{ endedAt: null }, { endedAt: { gte: day } }] },
        ],
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
