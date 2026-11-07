import { Injectable } from '@nestjs/common';
import { LeaseStatus, Prisma, TaxiLicense } from '@prisma/client';
import {
  addDays,
  annualFeeDueDate,
  contactDisplayName,
  normalizePlate,
  taxiAgeStatus,
  type Paginated,
  type TaxiLicenseAlert,
  type TaxiLicenseCreate,
  type TaxiLicenseQuery,
  type TaxiLicenseRegisterVehicle,
  type TaxiLicenseStatus,
  type TaxiLicenseUpdate,
} from '@renawi/shared';
import { expiryState, readLeadDays } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, dbDateOpt, isoOrNull } from '../common/dates';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { CONTACT_NAME_SELECT, NamedRef, searchTokens } from '../common/refs';
import { toDbMoneyOrNull } from '../prisma/prisma.decimal';
import { PrismaService } from '../prisma/prisma.service';

/** Segment with its contract, driver and car (for licence views). */
const SEGMENT_REF_INCLUDE = {
  contract: {
    select: {
      id: true,
      contractNo: true,
      status: true,
      driver: { select: { id: true, contact: { select: CONTACT_NAME_SELECT } } },
    },
  },
  vehicle: { select: { id: true, plateNo: true } },
} satisfies Prisma.LeaseSegmentInclude;
type SegmentWithRefs = Prisma.LeaseSegmentGetPayload<{ include: typeof SEGMENT_REF_INCLUDE }>;

const LIST_INCLUDE = {
  registeredVehicle: { select: { id: true, plateNo: true } },
  segments: { where: { endDate: null }, take: 1, include: SEGMENT_REF_INCLUDE },
} satisfies Prisma.TaxiLicenseInclude;
type LicenseWithRefs = Prisma.TaxiLicenseGetPayload<{ include: typeof LIST_INCLUDE }>;

export interface LicenseSegmentRef {
  id: string;
  contractId: string;
  contractNo: number;
  contractStatus: LeaseStatus;
  driver: NamedRef;
  vehicle: { id: string; plateNo: string } | null;
  monthlyRent: Prisma.Decimal;
  startDate: Date;
}

export interface LicenseSegmentHistory extends LicenseSegmentRef {
  endDate: Date | null;
  reason: string | null;
}

/** `GET /taxi-licenses` item. */
export interface TaxiLicenseListItem extends TaxiLicense {
  registeredVehicle: { id: string; plateNo: string } | null;
  /** The open lease segment (also a DRAFT contract's, which already reserves the licence). */
  currentSegment: LicenseSegmentRef | null;
  alerts: TaxiLicenseAlert[];
}

/** `GET /taxi-licenses/:id`. */
export interface TaxiLicenseDetail extends TaxiLicenseListItem {
  /** Every segment on this licence, newest first. */
  segments: LicenseSegmentHistory[];
  documentCount: number;
}

const SORTABLE_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'licenseNo',
  'status',
  'annualFeeDueAt',
  'renewalAt',
  'acquiredAt',
]);
const NULLABLE_SORT_FIELDS = new Set(['annualFeeDueAt', 'renewalAt', 'acquiredAt']);

function segmentRef(s: SegmentWithRefs): LicenseSegmentRef {
  return {
    id: s.id,
    contractId: s.contract.id,
    contractNo: s.contract.contractNo,
    contractStatus: s.contract.status,
    driver: { id: s.contract.driver.id, name: contactDisplayName(s.contract.driver.contact) },
    vehicle: s.vehicle ?? null,
    monthlyRent: s.monthlyRent,
    startDate: s.startDate,
  };
}

export interface TaxiLicenseAlertInput {
  status: TaxiLicenseStatus;
  annualFeeDueAt: string | null;
  renewalAt: string | null;
  hasOpenSegment: boolean;
}

/** Alert codes of a licence (none once SOLD). */
export function taxiLicenseAlerts(
  l: TaxiLicenseAlertInput,
  today: string,
  leadDays: number,
): TaxiLicenseAlert[] {
  if (l.status === 'SOLD') return [];
  const horizon = addDays(today, leadDays);
  const alerts: TaxiLicenseAlert[] = [];
  const fee = expiryState(l.annualFeeDueAt, today, horizon);
  if (fee === 'expired') alerts.push('annualFeeOverdue');
  else if (fee === 'expiring') alerts.push('annualFeeDue');
  const renewal = expiryState(l.renewalAt, today, horizon);
  if (renewal === 'expired') alerts.push('renewalOverdue');
  else if (renewal === 'expiring') alerts.push('renewalDue');
  if (l.status === 'ACTIVE' && !l.hasOpenSegment) alerts.push('idle');
  return alerts;
}

/** Re-throws a unique violation on licenseNo / registeredVehicleId as the API's 409. */
function rethrowUnique(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = JSON.stringify(e.meta?.target ?? '');
    if (target.includes('licenseNo')) throw AppException.duplicate('licenseNo');
    if (target.includes('registeredVehicleId')) {
      throw AppException.conflict(ErrorKey.vehicleAlreadyRegistered);
    }
  }
  throw e;
}

@Injectable()
export class TaxiLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(query: TaxiLicenseQuery): Promise<Paginated<TaxiLicenseListItem>> {
    const where = this.buildWhere(query);
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const orderBy: Prisma.TaxiLicenseOrderByWithRelationInput[] = [
      NULLABLE_SORT_FIELDS.has(sort)
        ? { [sort]: { sort: query.order, nulls: 'last' } }
        : { [sort]: query.order },
      { id: 'asc' },
    ];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.taxiLicense.count({ where }),
      this.prisma.taxiLicense.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: LIST_INCLUDE,
      }),
    ]);
    const today = this.clock.today();
    const lead = (await readLeadDays(this.prisma)).taxiLicense;
    return {
      items: rows.map((r) => this.toListItem(r, today, lead)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<TaxiLicenseDetail> {
    const row = await this.prisma.taxiLicense.findUnique({
      where: { id },
      include: { ...LIST_INCLUDE, _count: { select: { documents: true } } },
    });
    if (!row) throw AppException.notFound();
    const { _count, ...withRefs } = row;
    const lead = (await readLeadDays(this.prisma)).taxiLicense;
    const item = this.toListItem(withRefs, this.clock.today(), lead);
    const history = await this.prisma.leaseSegment.findMany({
      where: { taxiLicenseId: id },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      include: SEGMENT_REF_INCLUDE,
    });
    return {
      ...item,
      segments: history.map((s) => ({ ...segmentRef(s), endDate: s.endDate, reason: s.reason })),
      documentCount: _count.documents,
    };
  }

  async getRow(id: string, field?: string): Promise<TaxiLicense> {
    const row = await this.prisma.taxiLicense.findUnique({ where: { id } });
    if (!row) throw field ? AppException.notFoundField(field) : AppException.notFound();
    return row;
  }

  async create(dto: TaxiLicenseCreate): Promise<TaxiLicenseDetail> {
    await this.assertLicenseNoFree(dto.licenseNo);
    const feeDue =
      dto.annualFeeDueAt === undefined
        ? annualFeeDueDate(Number(this.clock.today().slice(0, 4)))
        : dto.annualFeeDueAt;
    let id: string;
    try {
      ({ id } = await this.prisma.taxiLicense.create({
        data: {
          licenseNo: dto.licenseNo,
          holderName: dto.holderName ?? null,
          status: dto.status,
          acquiredAt: dto.acquiredAt ? dbDate(dto.acquiredAt) : null,
          acquisitionPrice: toDbMoneyOrNull(dto.acquisitionPrice),
          soldAt: dto.soldAt ? dbDate(dto.soldAt) : null,
          salePrice: toDbMoneyOrNull(dto.salePrice),
          annualFeeDueAt: feeDue ? dbDate(feeDue) : null,
          renewalAt: dto.renewalAt ? dbDate(dto.renewalAt) : null,
          notes: dto.notes ?? null,
        },
        select: { id: true },
      }));
    } catch (e) {
      rethrowUnique(e);
    }
    return this.get(id);
  }

  async update(id: string, dto: TaxiLicenseUpdate): Promise<TaxiLicenseDetail> {
    const current = await this.getRow(id);
    if (dto.licenseNo !== undefined && dto.licenseNo !== current.licenseNo) {
      await this.assertLicenseNoFree(dto.licenseNo, id);
    }
    if (dto.status === 'SOLD' && dto.soldAt === undefined && !current.soldAt) {
      throw AppException.fieldError('soldAt', 'validation.soldAtRequired');
    }
    try {
      await this.prisma.taxiLicense.update({
        where: { id },
        data: {
          licenseNo: dto.licenseNo,
          holderName: dto.holderName,
          status: dto.status,
          acquiredAt: dbDateOpt(dto.acquiredAt),
          acquisitionPrice:
            dto.acquisitionPrice === undefined ? undefined : toDbMoneyOrNull(dto.acquisitionPrice),
          soldAt: dbDateOpt(dto.soldAt),
          salePrice: dto.salePrice === undefined ? undefined : toDbMoneyOrNull(dto.salePrice),
          annualFeeDueAt: dbDateOpt(dto.annualFeeDueAt),
          renewalAt: dbDateOpt(dto.renewalAt),
          notes: dto.notes,
        },
      });
    } catch (e) {
      rethrowUnique(e);
    }
    return this.get(id);
  }

  /**
   * Sets (or with `vehicleId: null` clears) the car registered under the licence at the MoT.
   * The car must be a taxi younger than 12 years and carry no other licence.
   */
  async registerVehicle(id: string, dto: TaxiLicenseRegisterVehicle): Promise<TaxiLicenseDetail> {
    await this.getRow(id);
    if (dto.vehicleId === null) {
      await this.prisma.taxiLicense.update({ where: { id }, data: { registeredVehicleId: null } });
      return this.get(id);
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle) throw AppException.notFoundField('vehicleId');
    if (!vehicle.isTaxi) throw AppException.conflict(ErrorKey.vehicleNotTaxi);
    if (taxiAgeStatus(vehicle.year, dto.date ?? this.clock.today()).blocked) {
      throw AppException.conflict(ErrorKey.taxiAgeBlocked);
    }
    const other = await this.prisma.taxiLicense.findFirst({
      where: { registeredVehicleId: vehicle.id, id: { not: id } },
      select: { id: true },
    });
    if (other) throw AppException.conflict(ErrorKey.vehicleAlreadyRegistered);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.taxiLicense.update({ where: { id }, data: { registeredVehicleId: vehicle.id } });
        if (dto.meterSealedAt) {
          await tx.vehicle.update({
            where: { id: vehicle.id },
            data: { meterSealedAt: dbDate(dto.meterSealedAt) },
          });
        }
      });
    } catch (e) {
      rethrowUnique(e);
    }
    return this.get(id);
  }

  toListItem(row: LicenseWithRefs, today: string, leadDays: number): TaxiLicenseListItem {
    const { registeredVehicle, segments, ...license } = row;
    const open = segments[0];
    return {
      ...license,
      registeredVehicle: registeredVehicle ?? null,
      currentSegment: open ? segmentRef(open) : null,
      alerts: taxiLicenseAlerts(
        {
          status: license.status,
          annualFeeDueAt: isoOrNull(license.annualFeeDueAt),
          renewalAt: isoOrNull(license.renewalAt),
          hasOpenSegment: Boolean(open),
        },
        today,
        leadDays,
      ),
    };
  }

  private async assertLicenseNoFree(licenseNo: string, exceptId?: string): Promise<void> {
    const other = await this.prisma.taxiLicense.findFirst({
      where: { licenseNo, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw AppException.duplicate('licenseNo');
  }

  private buildWhere(query: TaxiLicenseQuery): Prisma.TaxiLicenseWhereInput {
    const and: Prisma.TaxiLicenseWhereInput[] = [];
    if (query.status?.length) and.push({ status: { in: query.status } });
    if (query.available === true) and.push({ segments: { none: { endDate: null } } });
    if (query.available === false) and.push({ segments: { some: { endDate: null } } });
    for (const token of searchTokens(query.q)) {
      const text = { contains: token, mode: 'insensitive' as const };
      const or: Prisma.TaxiLicenseWhereInput[] = [{ licenseNo: text }, { holderName: text }];
      const plate = normalizePlate(token);
      if (/^\d{2,8}$/.test(plate)) or.push({ registeredVehicle: { plateNo: { contains: plate } } });
      and.push({ OR: or });
    }
    return and.length ? { AND: and } : {};
  }
}
