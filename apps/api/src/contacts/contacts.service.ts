import { Injectable } from '@nestjs/common';
import { AuditAction, Contact, ContactTag, DriverStatus, Prisma } from '@prisma/client';
import {
  contactDisplayName,
  msg,
  normalizePhone,
  type ContactCreate,
  type ContactQuery,
  type ContactUpdate,
  type Paginated,
} from '@renawi/shared';
import { AuditService } from '../common/audit/audit.service';
import { dbDate, dbDateOpt } from '../common/dates';
import { AppException } from '../common/errors/app-exception';
import { searchTokens } from '../common/refs';
import { PrismaService } from '../prisma/prisma.service';

/** Contact row + its driver profile (if the contact is a driver). */
export type ContactListItem = Contact & { driver: { id: string; status: DriverStatus } | null };

/** `GET /contacts/:id`: list item + related record counts. */
export type ContactDetail = ContactListItem & { counts: { deals: number; documents: number } };

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'firstName',
  'lastName',
  'companyName',
  'city',
  'followUpAt',
]);
const NULLABLE_SORT_FIELDS = new Set([
  'firstName',
  'lastName',
  'companyName',
  'city',
  'followUpAt',
]);

const DRIVER_SELECT = { select: { id: true, status: true } } as const;

function uniqueList<T>(values: readonly T[] | undefined): T[] | undefined {
  return values ? [...new Set(values)] : undefined;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ContactQuery): Promise<Paginated<ContactListItem>> {
    const where = await this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const orderBy: Prisma.ContactOrderByWithRelationInput[] = [
      NULLABLE_SORT_FIELDS.has(sort)
        ? { [sort]: { sort: query.order, nulls: 'last' } }
        : { [sort]: query.order },
      { id: 'asc' },
    ];
    const [total, items] = await this.prisma.$transaction([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { driver: DRIVER_SELECT },
      }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string): Promise<ContactDetail> {
    const row = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        driver: DRIVER_SELECT,
        _count: { select: { deals: true, documents: true } },
      },
    });
    if (!row) throw AppException.notFound();
    const { _count, ...contact } = row;
    return { ...contact, counts: { deals: _count.deals, documents: _count.documents } };
  }

  /** Throws 404 unless the contact exists (`field` adds `errors: [{ path: field }]`). */
  async assertExists(id: string, field?: string): Promise<Contact> {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    if (!row) throw field ? AppException.notFoundField(field) : AppException.notFound();
    return row;
  }

  async create(dto: ContactCreate): Promise<ContactDetail> {
    await this.assertIdNumberFree(dto.idNumber);
    const row = await this.prisma.contact.create({
      data: {
        tags: uniqueList(dto.tags) ?? [],
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        companyName: dto.companyName ?? null,
        idNumber: dto.idNumber ?? null,
        phones: uniqueList(dto.phones) ?? [],
        email: dto.email ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        preferredLang: dto.preferredLang,
        source: dto.source ?? null,
        notes: dto.notes ?? null,
        followUpAt: dto.followUpAt ? dbDate(dto.followUpAt) : null,
      },
    });
    return this.get(row.id);
  }

  async update(id: string, dto: ContactUpdate): Promise<ContactDetail> {
    const current = await this.assertExists(id);
    const merged = {
      firstName: dto.firstName !== undefined ? dto.firstName : current.firstName,
      lastName: dto.lastName !== undefined ? dto.lastName : current.lastName,
      companyName: dto.companyName !== undefined ? dto.companyName : current.companyName,
    };
    if (!contactDisplayName(merged)) throw AppException.fieldError('firstName', msg.nameRequired);
    if (dto.idNumber && dto.idNumber !== current.idNumber) {
      await this.assertIdNumberFree(dto.idNumber, id);
    }
    await this.prisma.contact.update({
      where: { id },
      data: {
        tags: uniqueList(dto.tags),
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyName: dto.companyName,
        idNumber: dto.idNumber,
        phones: uniqueList(dto.phones),
        email: dto.email,
        address: dto.address,
        city: dto.city,
        preferredLang: dto.preferredLang,
        source: dto.source,
        notes: dto.notes,
        followUpAt: dbDateOpt(dto.followUpAt),
      },
    });
    return this.get(id);
  }

  /** Archive (keeps the first archive timestamp) or restore. */
  async setArchived(id: string, archived: boolean): Promise<ContactDetail> {
    const current = await this.assertExists(id);
    const archivedAt = archived ? (current.archivedAt ?? new Date()) : null;
    if (archivedAt !== current.archivedAt) {
      await this.prisma.contact.update({ where: { id }, data: { archivedAt } });
    }
    return this.get(id);
  }

  /**
   * Adds a tag to a contact if missing (e.g. CONSIGNOR on consignment intake) and audits it.
   * Accepts a transaction client so it can join the caller's transaction.
   */
  async addTag(
    id: string,
    tag: ContactTag,
    userId: string | null,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const before = await tx.contact.findUnique({ where: { id } });
    if (!before || before.tags.includes(tag)) return;
    const after = await tx.contact.update({ where: { id }, data: { tags: { push: tag } } });
    await this.audit.record({
      userId,
      entity: 'Contact',
      entityId: id,
      action: AuditAction.UPDATE,
      before,
      after,
    });
  }

  private async assertIdNumberFree(idNumber: string | null | undefined, exceptId?: string) {
    if (!idNumber) return;
    const other = await this.prisma.contact.findFirst({
      where: { idNumber, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw AppException.duplicate('idNumber');
  }

  private async buildWhere(query: ContactQuery): Promise<Prisma.ContactWhereInput> {
    const and: Prisma.ContactWhereInput[] = [];
    if (query.archived === true) and.push({ archivedAt: { not: null } });
    else if (query.archived === false || !query.includeArchived) and.push({ archivedAt: null });
    if (query.tag?.length) and.push({ tags: { hasSome: query.tag } });
    if (query.followUpBefore) and.push({ followUpAt: { lte: dbDate(query.followUpBefore) } });

    // Every search token must match one of the fields (so "first last" finds the person).
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.ContactWhereInput[] = [
        { firstName: text },
        { lastName: text },
        { companyName: text },
        { email: text },
        { idNumber: { contains: token.replace(/[\s\-./]/g, '') } },
      ];
      const digits = normalizePhone(token).replace(/\D/g, '');
      if (digits.length >= 3) {
        const pattern = `%${digits}%`;
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Contact" WHERE array_to_string("phones", ' ') LIKE ${pattern}`;
        if (rows.length) or.push({ id: { in: rows.map((r) => r.id) } });
      }
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
