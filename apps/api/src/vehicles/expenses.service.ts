import { Injectable } from '@nestjs/common';
import { Prisma, VehicleExpense } from '@prisma/client';
import { msg, type ExpenseCreate, type ExpenseQuery, type ExpenseUpdate } from '@renawi/shared';
import { dbDate } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { CONTACT_NAME_SELECT, contactRef, NamedRef } from '../common/refs';
import { DocumentsService } from '../documents/documents.service';
import { toDbMoney } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseSummary, summarizeExpenses } from './vehicle-views';
import { VehiclesService } from './vehicles.service';

/** Expense row + its vendor `{ id, name }`. */
export type ExpenseView = VehicleExpense & { vendor: NamedRef | null };

/** `GET /vehicles/:id/expenses`: matching expenses (newest first) + totals over them. */
export interface ExpenseList {
  items: ExpenseView[];
  summary: ExpenseSummary;
}

const VENDOR_INCLUDE = { vendor: { select: CONTACT_NAME_SELECT } } as const;

type ExpenseWithVendor = Prisma.VehicleExpenseGetPayload<{ include: typeof VENDOR_INCLUDE }>;

function toView(row: ExpenseWithVendor): ExpenseView {
  return { ...row, vendor: contactRef(row.vendor) };
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vehicles: VehiclesService,
    private readonly documents: DocumentsService,
  ) {}

  /** All matching expenses of a vehicle (page/pageSize are ignored) with totals. */
  async list(vehicleId: string, query: ExpenseQuery): Promise<ExpenseList> {
    await this.vehicles.getRow(vehicleId);
    let { from, to } = query;
    if (from && to && from > to) [from, to] = [to, from];
    const where: Prisma.VehicleExpenseWhereInput = {
      vehicleId,
      ...(query.category?.length ? { category: { in: query.category } } : {}),
      ...(query.paidBy ? { paidBy: query.paidBy } : {}),
      ...(query.cycleId ? { cycleId: query.cycleId } : {}),
      ...(from || to
        ? { date: { gte: from ? dbDate(from) : undefined, lte: to ? dbDate(to) : undefined } }
        : {}),
    };
    const rows = await this.prisma.vehicleExpense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: VENDOR_INCLUDE,
    });
    return { items: rows.map(toView), summary: summarizeExpenses(rows) };
  }

  async get(id: string): Promise<ExpenseView> {
    const row = await this.prisma.vehicleExpense.findUnique({
      where: { id },
      include: VENDOR_INCLUDE,
    });
    if (!row) throw AppException.notFound();
    return toView(row);
  }

  /** Creates an expense; without `cycleId` it is linked to the vehicle's open cycle (if any). */
  async create(vehicleId: string, dto: ExpenseCreate): Promise<ExpenseView> {
    await this.vehicles.getRow(vehicleId);
    if (dto.vendorId) await this.assertVendor(dto.vendorId);
    let cycleId: string | null;
    if (dto.cycleId === undefined) cycleId = (await this.vehicles.openCycle(vehicleId))?.id ?? null;
    else cycleId = dto.cycleId ? await this.assertCycleOf(vehicleId, dto.cycleId) : null;

    const row = await this.prisma.vehicleExpense.create({
      data: {
        vehicleId,
        cycleId,
        category: dto.category,
        date: dbDate(dto.date),
        amount: toDbMoney(dto.amount),
        vatIncluded: dto.vatIncluded,
        vatReclaimable: dto.vatReclaimable,
        paidBy: dto.paidBy,
        vendorId: dto.vendorId ?? null,
        description: dto.description ?? null,
      },
      include: VENDOR_INCLUDE,
    });
    return toView(row);
  }

  /** Partial update; the amount of an expense already passed on to a driver cannot change. */
  async update(id: string, dto: ExpenseUpdate): Promise<ExpenseView> {
    const current = await this.getRow(id);
    if (
      current.rebilledEntryId &&
      dto.amount !== undefined &&
      !toDbMoney(dto.amount).equals(current.amount)
    ) {
      throw AppException.conflict(ErrorKey.expenseRebilled);
    }
    if (dto.vendorId) await this.assertVendor(dto.vendorId);
    const cycleId =
      dto.cycleId === undefined
        ? undefined
        : dto.cycleId === null
          ? null
          : await this.assertCycleOf(current.vehicleId, dto.cycleId);

    const row = await this.prisma.vehicleExpense.update({
      where: { id },
      data: {
        cycleId,
        category: dto.category,
        date: dto.date ? dbDate(dto.date) : undefined,
        amount: dto.amount === undefined ? undefined : toDbMoney(dto.amount),
        vatIncluded: dto.vatIncluded,
        vatReclaimable: dto.vatReclaimable,
        paidBy: dto.paidBy,
        vendorId: dto.vendorId,
        description: dto.description,
      },
      include: VENDOR_INCLUDE,
    });
    return toView(row);
  }

  /** Hard delete (with its documents) unless it was passed on to a driver (409). */
  async delete(id: string): Promise<void> {
    const current = await this.getRow(id);
    if (current.rebilledEntryId) throw AppException.conflict(ErrorKey.expenseRebilled);
    const docs = await this.prisma.document.findMany({
      where: { expenseId: id },
      select: { fileKey: true, hasThumb: true },
    });
    // Document rows cascade with the expense; their files are removed afterwards.
    await this.prisma.vehicleExpense.delete({ where: { id } });
    await this.documents.removeFiles(docs);
  }

  private async getRow(id: string): Promise<VehicleExpense> {
    const row = await this.prisma.vehicleExpense.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return row;
  }

  private async assertVendor(vendorId: string): Promise<void> {
    const found = await this.prisma.contact.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!found) throw AppException.notFoundField('vendorId');
  }

  /** The cycle must belong to the vehicle; returns its id. */
  private async assertCycleOf(vehicleId: string, cycleId: string): Promise<string> {
    const cycle = await this.prisma.inventoryCycle.findUnique({
      where: { id: cycleId },
      select: { vehicleId: true },
    });
    if (!cycle || cycle.vehicleId !== vehicleId) {
      throw AppException.fieldError('cycleId', msg.invalidValue);
    }
    return cycleId;
  }
}
