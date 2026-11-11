import { Injectable } from '@nestjs/common';
import { Prisma, Reminder } from '@prisma/client';
import {
  msg,
  type EntityType,
  type Paginated,
  type ReminderCreate,
  type ReminderQuery,
  type ReminderUpdate,
} from '@renawi/shared';
import { dbDate } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { reminderEntityLink } from './feed-rules';
import { asEntityType } from './reminders-feed.service';

/** Manual reminder before wire serialisation (`ReminderSchema` once dates are strings). */
export type ReminderRow = Omit<Reminder, 'entityType'> & {
  entityType: EntityType | null;
  link: string;
};

const SORTABLE = new Set(['dueAt', 'createdAt', 'title', 'doneAt']);

type FindById = (args: { where: { id: string }; select: { id: true } }) => Promise<unknown>;

/** Manual reminders: CRUD + done / undone. */
@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  /** `GET /reminders`: default order `dueAt` ascending (earliest first). */
  async list(q: ReminderQuery): Promise<Paginated<ReminderRow>> {
    const where: Prisma.ReminderWhereInput = {
      ...(q.done === undefined ? {} : { doneAt: q.done ? { not: null } : null }),
      ...(q.dueBefore ? { dueAt: { lte: dbDate(q.dueBefore) } } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
    };
    const orderBy: Prisma.ReminderOrderByWithRelationInput[] =
      q.sort && SORTABLE.has(q.sort)
        ? [{ [q.sort]: q.order }, { id: 'asc' }]
        : [{ dueAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }];
    const [rows, total] = await Promise.all([
      this.prisma.reminder.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.reminder.count({ where }),
    ]);
    return { items: rows.map(toRow), total, page: q.page, pageSize: q.pageSize };
  }

  async get(id: string): Promise<ReminderRow> {
    const row = await this.prisma.reminder.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return toRow(row);
  }

  async create(dto: ReminderCreate): Promise<ReminderRow> {
    const link = await this.checkLink(dto.entityType ?? null, dto.entityId ?? null);
    const row = await this.prisma.reminder.create({
      data: {
        title: dto.title,
        dueAt: dbDate(dto.dueAt),
        entityType: link.entityType,
        entityId: link.entityId,
        notes: dto.notes ?? null,
      },
    });
    return toRow(row);
  }

  async update(id: string, dto: ReminderUpdate): Promise<ReminderRow> {
    const current = await this.prisma.reminder.findUnique({ where: { id } });
    if (!current) throw AppException.notFound();
    const data: Prisma.ReminderUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.dueAt !== undefined ? { dueAt: dbDate(dto.dueAt) } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };
    if (dto.entityType !== undefined || dto.entityId !== undefined) {
      const entityType =
        dto.entityType !== undefined ? dto.entityType : asEntityType(current.entityType);
      const entityId = dto.entityId !== undefined ? dto.entityId : current.entityId;
      const link = await this.checkLink(entityType ?? null, entityId ?? null);
      data.entityType = link.entityType;
      data.entityId = link.entityId;
    }
    return toRow(await this.prisma.reminder.update({ where: { id }, data }));
  }

  /** Marks the reminder done (keeps the first `doneAt` when called again). */
  async done(id: string): Promise<ReminderRow> {
    const current = await this.prisma.reminder.findUnique({ where: { id } });
    if (!current) throw AppException.notFound();
    if (current.doneAt) return toRow(current);
    return toRow(
      await this.prisma.reminder.update({ where: { id }, data: { doneAt: new Date() } }),
    );
  }

  async undone(id: string): Promise<ReminderRow> {
    const current = await this.prisma.reminder.findUnique({ where: { id } });
    if (!current) throw AppException.notFound();
    if (!current.doneAt) return toRow(current);
    return toRow(await this.prisma.reminder.update({ where: { id }, data: { doneAt: null } }));
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.reminder.deleteMany({ where: { id } });
    if (count === 0) throw AppException.notFound();
  }

  /**
   * A link needs both `entityType` and `entityId` (or neither); the entity must exist
   * (404 `errors.notFound` on `entityId` otherwise).
   */
  private async checkLink(
    entityType: EntityType | null,
    entityId: string | null,
  ): Promise<{ entityType: EntityType | null; entityId: string | null }> {
    if (!entityType && !entityId) return { entityType: null, entityId: null };
    if (!entityType) throw AppException.fieldError('entityType', msg.required);
    if (!entityId) throw AppException.fieldError('entityId', msg.required);
    const finders: Record<EntityType, FindById> = {
      VEHICLE: (a) => this.prisma.vehicle.findUnique(a),
      TAXI_LICENSE: (a) => this.prisma.taxiLicense.findUnique(a),
      DRIVER: (a) => this.prisma.driver.findUnique(a),
      CONTACT: (a) => this.prisma.contact.findUnique(a),
      LEASE: (a) => this.prisma.leaseContract.findUnique(a),
      DEAL: (a) => this.prisma.deal.findUnique(a),
      FINE: (a) => this.prisma.trafficFine.findUnique(a),
      INSURANCE: (a) => this.prisma.insurancePolicy.findUnique(a),
      DOCUMENT: (a) => this.prisma.document.findUnique(a),
      LEDGER_ENTRY: (a) => this.prisma.ledgerEntry.findUnique(a),
    };
    const found = await finders[entityType]({ where: { id: entityId }, select: { id: true } });
    if (!found) throw AppException.notFoundField('entityId');
    return { entityType, entityId };
  }
}

function toRow(r: Reminder): ReminderRow {
  const entityType = asEntityType(r.entityType);
  return { ...r, entityType, link: reminderEntityLink(entityType, r.entityId) };
}
