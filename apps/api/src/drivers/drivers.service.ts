import { Injectable } from '@nestjs/common';
import { AuditAction, Driver, LeaseStatus, LeaseType, Prisma } from '@prisma/client';
import {
  addDays,
  contactDisplayName,
  normalizePhone,
  type DriverAlert,
  type DriverCreate,
  type DriverLedgerQuery,
  type DriverQuery,
  type DriverStatus,
  type DriverUpdate,
  type Paginated,
  type ReminderLeadDays,
} from '@renawi/shared';
import { AuditService } from '../common/audit/audit.service';
import { expiryState, readLeadDays } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, dbDateOpt, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { searchTokens } from '../common/refs';
import { ContactsService } from '../contacts/contacts.service';
import {
  AgeingView,
  BalanceView,
  overdueAmount,
  toBalanceView,
  ZERO_AGEING,
} from '../ledger/ledger-views';
import { DriverStatement, LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

const CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  companyName: true,
  phones: true,
  idNumber: true,
  email: true,
  preferredLang: true,
} as const;

/** Latest segment of a contract with its licence number and car plate. */
const LATEST_SEGMENT = {
  orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  take: 1,
  include: {
    taxiLicense: { select: { id: true, licenseNo: true } },
    vehicle: { select: { id: true, plateNo: true } },
  },
} satisfies Prisma.LeaseContract$segmentsArgs;

const LIST_INCLUDE = {
  contact: { select: CONTACT_SELECT },
  contracts: {
    where: { status: 'ACTIVE' },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    take: 1,
    include: { segments: LATEST_SEGMENT },
  },
} satisfies Prisma.DriverInclude;
type DriverWithRefs = Prisma.DriverGetPayload<{ include: typeof LIST_INCLUDE }>;

export type DriverContact = Prisma.ContactGetPayload<{ select: typeof CONTACT_SELECT }>;

export interface ActiveContractRef {
  id: string;
  contractNo: number;
  type: LeaseType;
  licenseNo: string | null;
  plateNo: string | null;
  monthlyRent: Prisma.Decimal | null;
}

/** `GET /drivers` item. */
export interface DriverListItem extends Driver {
  contact: DriverContact;
  /** Display name of the contact. */
  name: string;
  activeContract: ActiveContractRef | null;
  balance: BalanceView;
  alerts: DriverAlert[];
}

export interface DriverContractRef {
  id: string;
  contractNo: number;
  type: LeaseType;
  status: LeaseStatus;
  startDate: Date;
  endDate: Date;
  actualEndDate: Date | null;
  licenseNo: string | null;
  plateNo: string | null;
  monthlyRent: Prisma.Decimal | null;
}

/** `GET /drivers/:id`. */
export interface DriverDetail extends DriverListItem {
  /** All contracts, newest first (licence / car / rent of their latest segment). */
  contracts: DriverContractRef[];
  ageing: AgeingView;
  /** The driver's own cars (THIRD_PARTY, for NUMBER_ONLY leases). */
  ownedVehicles: { id: string; plateNo: string; make: string; model: string; year: number }[];
  documentCount: number;
}

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'status',
  'licenseExpiry',
  'taxiPermitExpiry',
  'medicalExpiry',
  'startedAt',
  'name',
]);
const NULLABLE_SORT_FIELDS = new Set([
  'licenseExpiry',
  'taxiPermitExpiry',
  'medicalExpiry',
  'startedAt',
]);

export interface DriverAlertInput {
  status: DriverStatus;
  licenseExpiry: string | null;
  taxiPermitExpiry: string | null;
  medicalExpiry: string | null;
}

/**
 * Alert codes of a driver: document expiries (ACTIVE drivers only, lead days from settings)
 * and `overdue` when an open charge is past due.
 */
export function driverAlerts(
  d: DriverAlertInput,
  today: string,
  lead: Pick<ReminderLeadDays, 'driverLicense' | 'taxiPermit' | 'medical'>,
  overdue: boolean,
): DriverAlert[] {
  const alerts: DriverAlert[] = [];
  if (d.status === 'ACTIVE') {
    const checks: [string | null, number, DriverAlert, DriverAlert][] = [
      [d.licenseExpiry, lead.driverLicense, 'licenseExpired', 'licenseExpiring'],
      [d.taxiPermitExpiry, lead.taxiPermit, 'taxiPermitExpired', 'taxiPermitExpiring'],
      [d.medicalExpiry, lead.medical, 'medicalExpired', 'medicalExpiring'],
    ];
    for (const [date, days, expired, expiring] of checks) {
      const state = expiryState(date, today, addDays(today, days));
      if (state === 'expired') alerts.push(expired);
      else if (state === 'expiring') alerts.push(expiring);
    }
  }
  if (overdue) alerts.push('overdue');
  return alerts;
}

function contractRef(c: DriverWithRefs['contracts'][number]): ActiveContractRef {
  const seg = c.segments[0];
  return {
    id: c.id,
    contractNo: c.contractNo,
    type: c.type,
    licenseNo: seg?.taxiLicense.licenseNo ?? null,
    plateNo: seg?.vehicle?.plateNo ?? null,
    monthlyRent: seg?.monthlyRent ?? null,
  };
}

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly contacts: ContactsService,
    private readonly ledger: LedgerService,
  ) {}

  async list(query: DriverQuery): Promise<Paginated<DriverListItem>> {
    const where = await this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const orderBy: Prisma.DriverOrderByWithRelationInput[] =
      sort === 'name'
        ? [
            { contact: { lastName: { sort: query.order, nulls: 'last' } } },
            { contact: { firstName: { sort: query.order, nulls: 'last' } } },
            { id: 'asc' },
          ]
        : [
            NULLABLE_SORT_FIELDS.has(sort)
              ? { [sort]: { sort: query.order, nulls: 'last' } }
              : { [sort]: query.order },
            { id: 'asc' },
          ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.driver.count({ where }),
      this.prisma.driver.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: LIST_INCLUDE,
      }),
    ]);
    const ids = rows.map((r) => r.id);
    const [balances, ageing, lead] = await Promise.all([
      this.ledger.balancesFor(ids),
      this.ledger.ageingFor(ids),
      readLeadDays(this.prisma),
    ]);
    const today = this.clock.today();
    return {
      items: rows.map((r) =>
        this.toListItem(r, balances.get(r.id), ageing.get(r.id) ?? ZERO_AGEING, today, lead),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<DriverDetail> {
    const row = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        ...LIST_INCLUDE,
        ownedVehicles: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, plateNo: true, make: true, model: true, year: true },
        },
        _count: { select: { documents: true } },
      },
    });
    if (!row) throw AppException.notFound();
    const { ownedVehicles, _count, ...withRefs } = row;
    const [balance, ageing, lead, contracts] = await Promise.all([
      this.ledger.balanceOf(id),
      this.ledger.ageingOf(id),
      readLeadDays(this.prisma),
      this.prisma.leaseContract.findMany({
        where: { driverId: id },
        orderBy: [{ startDate: 'desc' }, { contractNo: 'desc' }],
        include: { segments: LATEST_SEGMENT },
      }),
    ]);
    const item = this.toListItem(withRefs, balance, ageing, this.clock.today(), lead);
    return {
      ...item,
      contracts: contracts.map((c) => {
        const ref = contractRef(c);
        return {
          id: c.id,
          contractNo: c.contractNo,
          type: c.type,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          actualEndDate: c.actualEndDate,
          licenseNo: ref.licenseNo,
          plateNo: ref.plateNo,
          monthlyRent: ref.monthlyRent,
        };
      }),
      ageing,
      ownedVehicles,
      documentCount: _count.documents,
    };
  }

  async getRow(id: string): Promise<Driver> {
    const row = await this.prisma.driver.findUnique({ where: { id } });
    if (!row) throw AppException.notFound();
    return row;
  }

  /**
   * Creates the driver profile of an existing contact (`contactId`) or of a new contact
   * (`contact`). The contact gets the DRIVER tag; a contact can be one driver only.
   */
  async create(dto: DriverCreate, userId: string | null): Promise<DriverDetail> {
    if (dto.contactId) {
      await this.contacts.assertExists(dto.contactId, 'contactId');
      const existing = await this.prisma.driver.findUnique({
        where: { contactId: dto.contactId },
        select: { id: true },
      });
      if (existing) throw AppException.conflict(ErrorKey.alreadyDriver);
    } else if (dto.contact?.idNumber) {
      const other = await this.prisma.contact.findFirst({
        where: { idNumber: dto.contact.idNumber },
        select: { id: true },
      });
      if (other) throw AppException.duplicate('contact.idNumber');
    }
    let createdContact: unknown = null;
    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        let contactId = dto.contactId;
        if (!contactId) {
          const c = dto.contact;
          if (!c) throw AppException.badRequest();
          const contact = await tx.contact.create({
            data: {
              tags: [...new Set([...c.tags, 'DRIVER' as const])],
              firstName: c.firstName ?? null,
              lastName: c.lastName ?? null,
              companyName: c.companyName ?? null,
              idNumber: c.idNumber ?? null,
              phones: [...new Set(c.phones)],
              email: c.email ?? null,
              address: c.address ?? null,
              city: c.city ?? null,
              preferredLang: c.preferredLang,
              source: c.source ?? null,
              notes: c.notes ?? null,
              followUpAt: c.followUpAt ? dbDate(c.followUpAt) : null,
            },
          });
          createdContact = contact;
          contactId = contact.id;
        } else {
          await this.contacts.addTag(contactId, 'DRIVER', userId, tx);
        }
        const driver = await tx.driver.create({
          data: {
            contactId,
            licenseNo: dto.licenseNo ?? null,
            licenseExpiry: dto.licenseExpiry ? dbDate(dto.licenseExpiry) : null,
            taxiPermitNo: dto.taxiPermitNo ?? null,
            taxiPermitExpiry: dto.taxiPermitExpiry ? dbDate(dto.taxiPermitExpiry) : null,
            medicalExpiry: dto.medicalExpiry ? dbDate(dto.medicalExpiry) : null,
            emergencyName: dto.emergencyName ?? null,
            emergencyPhone: dto.emergencyPhone ?? null,
            startedAt: dto.startedAt ? dbDate(dto.startedAt) : null,
            status: dto.status,
            notes: dto.notes ?? null,
          },
        });
        return driver.id;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        if (JSON.stringify(e.meta?.target ?? '').includes('contactId')) {
          throw AppException.conflict(ErrorKey.alreadyDriver);
        }
      }
      throw e;
    }
    if (createdContact) {
      const contact = createdContact as { id: string };
      await this.audit.record({
        userId,
        entity: 'Contact',
        entityId: contact.id,
        action: AuditAction.CREATE,
        after: createdContact,
      });
    }
    return this.get(id);
  }

  /** Driver fields; an optional `contact` block is applied through the contacts rules. */
  async update(id: string, dto: DriverUpdate): Promise<DriverDetail> {
    const current = await this.getRow(id);
    if (dto.contact) await this.contacts.update(current.contactId, dto.contact);
    await this.prisma.driver.update({
      where: { id },
      data: {
        licenseNo: dto.licenseNo,
        licenseExpiry: dbDateOpt(dto.licenseExpiry),
        taxiPermitNo: dto.taxiPermitNo,
        taxiPermitExpiry: dbDateOpt(dto.taxiPermitExpiry),
        medicalExpiry: dbDateOpt(dto.medicalExpiry),
        emergencyName: dto.emergencyName,
        emergencyPhone: dto.emergencyPhone,
        startedAt: dbDateOpt(dto.startedAt),
        status: dto.status,
        notes: dto.notes,
      },
    });
    return this.get(id);
  }

  async statement(id: string, query: DriverLedgerQuery): Promise<DriverStatement> {
    await this.getRow(id);
    return this.ledger.statement(id, query);
  }

  toListItem(
    row: DriverWithRefs,
    balance: BalanceView | undefined,
    ageing: AgeingView,
    today: string,
    lead: ReminderLeadDays,
  ): DriverListItem {
    const { contracts, contact, ...driver } = row;
    const active = contracts[0];
    return {
      ...driver,
      contact,
      name: contactDisplayName(contact),
      activeContract: active ? contractRef(active) : null,
      balance: balance ?? toBalanceView(undefined),
      alerts: driverAlerts(
        {
          status: driver.status,
          licenseExpiry: isoOrNull(driver.licenseExpiry),
          taxiPermitExpiry: isoOrNull(driver.taxiPermitExpiry),
          medicalExpiry: isoOrNull(driver.medicalExpiry),
        },
        today,
        lead,
        overdueAmount(ageing).gt(0),
      ),
    };
  }

  private async buildWhere(query: DriverQuery): Promise<Prisma.DriverWhereInput> {
    const and: Prisma.DriverWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.hasActiveLease === true) and.push({ contracts: { some: { status: 'ACTIVE' } } });
    if (query.hasActiveLease === false) and.push({ contracts: { none: { status: 'ACTIVE' } } });
    if (query.expiringBefore) {
      const lte = dbDate(query.expiringBefore);
      and.push({
        OR: [{ licenseExpiry: { lte } }, { taxiPermitExpiry: { lte } }, { medicalExpiry: { lte } }],
      });
    }
    if (query.withBalanceOnly) {
      const rows = await this.prisma.$queryRaw<{ driverId: string }[]>`
        SELECT "driverId" FROM driver_balance_v WHERE balance > 0`;
      and.push({ id: { in: rows.map((r) => r.driverId) } });
    }
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.DriverWhereInput[] = [
        { contact: { firstName: text } },
        { contact: { lastName: text } },
        { contact: { companyName: text } },
        { contact: { email: text } },
        { contact: { idNumber: { contains: token.replace(/[\s\-./]/g, '') } } },
        { licenseNo: text },
        { taxiPermitNo: text },
      ];
      const digits = normalizePhone(token).replace(/\D/g, '');
      if (digits.length >= 3) {
        const pattern = `%${digits}%`;
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Contact" WHERE array_to_string("phones", ' ') LIKE ${pattern}`;
        if (rows.length) or.push({ contactId: { in: rows.map((r) => r.id) } });
      }
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
