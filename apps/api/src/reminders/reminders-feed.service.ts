import { Injectable } from '@nestjs/common';
import { Prisma, VehicleStatus } from '@prisma/client';
import {
  contactDisplayName,
  DOCUMENT_OWNER_KEYS,
  EntityType,
  FeedKind,
  formatPhone,
  formatPlate,
  type FeedCounts,
  type ReminderLeadDays,
  type RemindersFeed,
  type RemindersFeedQuery,
} from '@renawi/shared';
import { readLeadDays } from '../common/business-settings';
import { Clock } from '../common/clock';
import { dbDate, isoOf } from '../common/dates';
import { CONTACT_NAME_SELECT } from '../common/refs';
import { PrismaService } from '../prisma/prisma.service';
import {
  assembleFeed,
  dealerRegistrationDueAt,
  feedHorizon,
  leadDaysOf,
  reminderEntityLink,
  taxiAgeDates,
  type FeedCandidate,
} from './feed-rules';

/** Vehicles that left us: no reminders (same rule as the vehicle alerts). */
const GONE_STATUSES: VehicleStatus[] = ['SOLD', 'SCRAPPED', 'RETURNED'];
/** Dealer registration only matters while the car is for sale. */
const DEALER_STOCK_STATUSES: VehicleStatus[] = ['IN_STOCK', 'RESERVED'];

const VEHICLE_TITLE_SELECT = { plateNo: true, make: true, model: true } as const;

/** `84-731-26 · Skoda Octavia` */
export function vehicleTitle(v: { plateNo: string; make: string; model: string }): string {
  return `${formatPlate(v.plateNo)} · ${[v.make, v.model].filter(Boolean).join(' ')}`;
}

function firstPhone(phones: readonly string[] | null | undefined): string | null {
  const p = phones?.find(Boolean);
  return p ? formatPhone(p) : null;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** `Reminder.entityType` is a free string column holding an `EntityType` value. */
export function asEntityType(value: string | null | undefined): EntityType | null {
  const parsed = EntityType.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const enc = encodeURIComponent;

/** Last due date to load per requested kind (kinds not requested are absent). */
type Horizons = Partial<Record<FeedKind, string>>;

/**
 * Reminders feed: collects every dated obligation (expiries, deadlines, follow-ups, manual
 * reminders) from the database and classifies it with the pure rules of `feed-rules.ts`.
 */
@Injectable()
export class RemindersFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async feed(q: RemindersFeedQuery): Promise<RemindersFeed> {
    const today = this.clock.today();
    const lead = await readLeadDays(this.prisma);
    const candidates = await this.collect(today, q.days, lead, q.kinds);
    return assembleFeed(candidates, {
      today,
      days: q.days,
      lead,
      kinds: q.kinds,
      severity: q.severity,
      page: q.page,
      pageSize: q.pageSize,
    });
  }

  /** Severity counts of the whole feed (all kinds) for a `days` window (dashboard KPI). */
  async counts(days = 30): Promise<FeedCounts> {
    return (await this.feed({ days, page: 1, pageSize: 1 })).counts;
  }

  private async collect(
    today: string,
    days: number,
    lead: ReminderLeadDays,
    kinds: readonly FeedKind[] | undefined,
  ): Promise<FeedCandidate[]> {
    const wanted = new Set<FeedKind>(kinds?.length ? kinds : FeedKind.options);
    const h: Horizons = {};
    for (const kind of wanted) h[kind] = feedHorizon(today, days, leadDaysOf(kind, lead));
    const parts = await Promise.all([
      this.vehicles(h, today),
      this.insurance(h),
      this.drivers(h),
      this.taxiLicenses(h),
      this.leases(h),
      this.documents(h),
      this.contacts(h),
      this.fines(h),
      this.deals(h),
      this.manual(h),
    ]);
    return parts.flat();
  }

  /** vehicleRegistration, dealerRegistration, taxiAge, taxiSemiAnnual. */
  private async vehicles(h: Horizons, today: string): Promise<FeedCandidate[]> {
    const or: Prisma.VehicleWhereInput[] = [];
    if (h.vehicleRegistration) {
      or.push({ registrationExpiry: { not: null, lte: dbDate(h.vehicleRegistration) } });
    }
    if (h.dealerRegistration) {
      or.push({ dealerRegisteredAt: { not: null }, status: { in: DEALER_STOCK_STATUSES } });
    }
    if (h.taxiAge || h.taxiSemiAnnual) or.push({ isTaxi: true });
    if (or.length === 0) return [];
    const rows = await this.prisma.vehicle.findMany({
      where: { status: { notIn: GONE_STATUSES }, OR: or },
      select: {
        id: true,
        ...VEHICLE_TITLE_SELECT,
        year: true,
        isTaxi: true,
        status: true,
        registrationExpiry: true,
        dealerRegisteredAt: true,
      },
    });
    const out: FeedCandidate[] = [];
    for (const v of rows) {
      const base = {
        entityType: 'vehicle' as const,
        entityId: v.id,
        title: vehicleTitle(v),
        link: `/vehicles/${enc(v.id)}`,
      };
      if (h.vehicleRegistration && v.registrationExpiry) {
        out.push({
          ...base,
          kind: 'vehicleRegistration',
          subtitle: String(v.year),
          dueAt: isoOf(v.registrationExpiry),
        });
      }
      if (
        h.dealerRegistration &&
        v.dealerRegisteredAt &&
        DEALER_STOCK_STATUSES.includes(v.status)
      ) {
        out.push({
          ...base,
          kind: 'dealerRegistration',
          subtitle: isoOf(v.dealerRegisteredAt),
          dueAt: dealerRegistrationDueAt(isoOf(v.dealerRegisteredAt)),
        });
      }
      if (v.isTaxi) {
        const dates = taxiAgeDates(v.year);
        if (h.taxiAge) {
          out.push({
            ...base,
            kind: 'taxiAge',
            subtitle: String(v.year),
            dueAt: dates.blockedFrom,
          });
        }
        // A heads-up before the regime starts; once in it, vehicleRegistration takes over.
        if (h.taxiSemiAnnual && dates.semiAnnualFrom >= today) {
          out.push({
            ...base,
            kind: 'taxiSemiAnnual',
            subtitle: String(v.year),
            dueAt: dates.semiAnnualFrom,
          });
        }
      }
    }
    return out;
  }

  /** insurance: the latest policy per vehicle + type (business policies: per type). */
  private async insurance(h: Horizons): Promise<FeedCandidate[]> {
    const horizon = h.insurance;
    if (!horizon) return [];
    const rows = await this.prisma.insurancePolicy.findMany({
      where: {
        OR: [
          { scope: 'BUSINESS' },
          { scope: 'VEHICLE', vehicle: { status: { notIn: GONE_STATUSES } } },
        ],
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        scope: true,
        type: true,
        insurer: true,
        policyNo: true,
        endDate: true,
        vehicleId: true,
        vehicle: { select: VEHICLE_TITLE_SELECT },
      },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const p of rows) {
      const key = `${p.scope === 'BUSINESS' ? 'BUSINESS' : (p.vehicleId ?? '')}:${p.type}`;
      if (!latest.has(key)) latest.set(key, p);
    }
    const out: FeedCandidate[] = [];
    for (const p of latest.values()) {
      const dueAt = isoOf(p.endDate);
      if (dueAt > horizon) continue;
      const policy = [p.insurer, p.policyNo].filter(Boolean).join(' · ');
      if (p.vehicle && p.vehicleId) {
        out.push({
          kind: 'insurance',
          entityType: 'insurance',
          entityId: p.id,
          title: vehicleTitle(p.vehicle),
          subtitle: policy || null,
          dueAt,
          link: `/vehicles/${enc(p.vehicleId)}?tab=insurance`,
        });
      } else {
        out.push({
          kind: 'insurance',
          entityType: 'insurance',
          entityId: p.id,
          title: p.insurer,
          subtitle: p.policyNo,
          dueAt,
          link: '/vehicles?tab=insurance',
        });
      }
    }
    return out;
  }

  /** driverLicense, taxiPermit, medical (ACTIVE drivers). */
  private async drivers(h: Horizons): Promise<FeedCandidate[]> {
    const or: Prisma.DriverWhereInput[] = [];
    if (h.driverLicense) or.push({ licenseExpiry: { lte: dbDate(h.driverLicense) } });
    if (h.taxiPermit) or.push({ taxiPermitExpiry: { lte: dbDate(h.taxiPermit) } });
    if (h.medical) or.push({ medicalExpiry: { lte: dbDate(h.medical) } });
    if (or.length === 0) return [];
    const rows = await this.prisma.driver.findMany({
      where: { status: 'ACTIVE', OR: or },
      select: {
        id: true,
        licenseNo: true,
        licenseExpiry: true,
        taxiPermitNo: true,
        taxiPermitExpiry: true,
        medicalExpiry: true,
        contact: { select: { ...CONTACT_NAME_SELECT, phones: true } },
      },
    });
    const out: FeedCandidate[] = [];
    for (const d of rows) {
      const base = {
        entityType: 'driver' as const,
        entityId: d.id,
        title: contactDisplayName(d.contact),
        link: `/drivers/${enc(d.id)}`,
      };
      const phone = firstPhone(d.contact.phones);
      if (h.driverLicense && d.licenseExpiry) {
        out.push({
          ...base,
          kind: 'driverLicense',
          subtitle: d.licenseNo ?? phone,
          dueAt: isoOf(d.licenseExpiry),
        });
      }
      if (h.taxiPermit && d.taxiPermitExpiry) {
        out.push({
          ...base,
          kind: 'taxiPermit',
          subtitle: d.taxiPermitNo ?? phone,
          dueAt: isoOf(d.taxiPermitExpiry),
        });
      }
      if (h.medical && d.medicalExpiry) {
        out.push({ ...base, kind: 'medical', subtitle: phone, dueAt: isoOf(d.medicalExpiry) });
      }
    }
    return out;
  }

  /** taxiLicenseFee, taxiLicenseRenewal (ACTIVE / SUSPENDED licences). */
  private async taxiLicenses(h: Horizons): Promise<FeedCandidate[]> {
    const or: Prisma.TaxiLicenseWhereInput[] = [];
    if (h.taxiLicenseFee) or.push({ annualFeeDueAt: { lte: dbDate(h.taxiLicenseFee) } });
    if (h.taxiLicenseRenewal) or.push({ renewalAt: { lte: dbDate(h.taxiLicenseRenewal) } });
    if (or.length === 0) return [];
    const rows = await this.prisma.taxiLicense.findMany({
      where: { status: { in: ['ACTIVE', 'SUSPENDED'] }, OR: or },
      select: {
        id: true,
        licenseNo: true,
        holderName: true,
        annualFeeDueAt: true,
        renewalAt: true,
        registeredVehicle: { select: { plateNo: true } },
      },
    });
    const out: FeedCandidate[] = [];
    for (const l of rows) {
      const base = {
        entityType: 'taxiLicense' as const,
        entityId: l.id,
        title: l.licenseNo,
        subtitle: l.registeredVehicle ? formatPlate(l.registeredVehicle.plateNo) : l.holderName,
        link: `/taxi-licenses/${enc(l.id)}`,
      };
      if (h.taxiLicenseFee && l.annualFeeDueAt) {
        out.push({ ...base, kind: 'taxiLicenseFee', dueAt: isoOf(l.annualFeeDueAt) });
      }
      if (h.taxiLicenseRenewal && l.renewalAt) {
        out.push({ ...base, kind: 'taxiLicenseRenewal', dueAt: isoOf(l.renewalAt) });
      }
    }
    return out;
  }

  /** leaseEnd (ACTIVE contracts). */
  private async leases(h: Horizons): Promise<FeedCandidate[]> {
    if (!h.leaseEnd) return [];
    const rows = await this.prisma.leaseContract.findMany({
      where: { status: 'ACTIVE', endDate: { lte: dbDate(h.leaseEnd) } },
      select: {
        id: true,
        contractNo: true,
        endDate: true,
        driver: { select: { contact: { select: CONTACT_NAME_SELECT } } },
        segments: {
          where: { endDate: null },
          take: 1,
          select: { taxiLicense: { select: { licenseNo: true } } },
        },
      },
    });
    return rows.map((c) => ({
      kind: 'leaseEnd' as const,
      entityType: 'lease' as const,
      entityId: c.id,
      title: contactDisplayName(c.driver.contact),
      subtitle: [`#${c.contractNo}`, c.segments[0]?.taxiLicense.licenseNo]
        .filter(Boolean)
        .join(' · '),
      dueAt: isoOf(c.endDate),
      link: `/leases/${enc(c.id)}`,
    }));
  }

  /** document: the latest `expiresAt` per owner + kind (documents of cars that left us excluded). */
  private async documents(h: Horizons): Promise<FeedCandidate[]> {
    const horizon = h.document;
    if (!horizon) return [];
    const rows = await this.prisma.document.findMany({
      where: {
        expiresAt: { not: null },
        OR: [{ vehicleId: null }, { vehicle: { status: { notIn: GONE_STATUSES } } }],
      },
      orderBy: [{ expiresAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        kind: true,
        title: true,
        fileName: true,
        expiresAt: true,
        vehicleId: true,
        driverId: true,
        contactId: true,
        dealId: true,
        contractId: true,
        taxiLicenseId: true,
        expenseId: true,
        ledgerEntryId: true,
        vehicle: { select: VEHICLE_TITLE_SELECT },
        driver: { select: { contact: { select: CONTACT_NAME_SELECT } } },
        contact: { select: CONTACT_NAME_SELECT },
        deal: { select: { dealNo: true } },
        contract: { select: { contractNo: true } },
        taxiLicense: { select: { licenseNo: true } },
        expense: { select: { vehicleId: true, vehicle: { select: VEHICLE_TITLE_SELECT } } },
        ledgerEntry: { select: { driverId: true } },
      },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const d of rows) {
      const ownerKey = DOCUMENT_OWNER_KEYS.find((k) => d[k] !== null);
      const key = ownerKey ? `${ownerKey}:${d[ownerKey]}:${d.kind}` : `none:${d.id}`;
      if (!latest.has(key)) latest.set(key, d);
    }
    const out: FeedCandidate[] = [];
    for (const d of latest.values()) {
      if (!d.expiresAt) continue;
      const dueAt = isoOf(d.expiresAt);
      if (dueAt > horizon) continue;
      let owner: string | null = null;
      let link = '/reminders';
      if (d.vehicleId && d.vehicle) {
        owner = vehicleTitle(d.vehicle);
        link = `/vehicles/${enc(d.vehicleId)}?tab=documents`;
      } else if (d.driverId && d.driver) {
        owner = contactDisplayName(d.driver.contact);
        link = `/drivers/${enc(d.driverId)}?tab=documents`;
      } else if (d.contactId && d.contact) {
        owner = contactDisplayName(d.contact);
        link = `/contacts/${enc(d.contactId)}?tab=documents`;
      } else if (d.dealId && d.deal) {
        owner = `#${d.deal.dealNo}`;
        link = `/deals/${enc(d.dealId)}?tab=documents`;
      } else if (d.contractId && d.contract) {
        owner = `#${d.contract.contractNo}`;
        link = `/leases/${enc(d.contractId)}?tab=documents`;
      } else if (d.taxiLicenseId && d.taxiLicense) {
        owner = d.taxiLicense.licenseNo;
        link = `/taxi-licenses/${enc(d.taxiLicenseId)}?tab=documents`;
      } else if (d.expenseId && d.expense) {
        owner = vehicleTitle(d.expense.vehicle);
        link = `/vehicles/${enc(d.expense.vehicleId)}?tab=expenses`;
      } else if (d.ledgerEntryId && d.ledgerEntry) {
        link = `/drivers/${enc(d.ledgerEntry.driverId)}?tab=ledger`;
      }
      out.push({
        kind: 'document',
        entityType: 'document',
        entityId: d.id,
        title: d.title?.trim() || d.fileName,
        subtitle: owner,
        dueAt,
        link,
      });
    }
    return out;
  }

  /** contactFollowUp (contacts not archived). */
  private async contacts(h: Horizons): Promise<FeedCandidate[]> {
    if (!h.contactFollowUp) return [];
    const rows = await this.prisma.contact.findMany({
      where: { archivedAt: null, followUpAt: { not: null, lte: dbDate(h.contactFollowUp) } },
      select: { ...CONTACT_NAME_SELECT, phones: true, followUpAt: true },
    });
    const out: FeedCandidate[] = [];
    for (const c of rows) {
      if (!c.followUpAt) continue;
      out.push({
        kind: 'contactFollowUp',
        entityType: 'contact',
        entityId: c.id,
        title: contactDisplayName(c),
        subtitle: firstPhone(c.phones),
        dueAt: isoOf(c.followUpAt),
        link: `/contacts/${enc(c.id)}`,
      });
    }
    return out;
  }

  /** fineReassign (status NEW / REASSIGN_SUBMITTED). */
  private async fines(h: Horizons): Promise<FeedCandidate[]> {
    if (!h.fineReassign) return [];
    const rows = await this.prisma.trafficFine.findMany({
      where: {
        status: { in: ['NEW', 'REASSIGN_SUBMITTED'] },
        reassignDeadline: { not: null, lte: dbDate(h.fineReassign) },
      },
      select: {
        id: true,
        fineNo: true,
        reassignDeadline: true,
        vehicleId: true,
        vehicle: { select: { plateNo: true } },
        driver: { select: { contact: { select: CONTACT_NAME_SELECT } } },
      },
    });
    const out: FeedCandidate[] = [];
    for (const f of rows) {
      if (!f.reassignDeadline) continue;
      out.push({
        kind: 'fineReassign',
        entityType: 'fine',
        entityId: f.id,
        title: [formatPlate(f.vehicle.plateNo), f.fineNo].filter(Boolean).join(' · '),
        subtitle: f.driver ? contactDisplayName(f.driver.contact) : null,
        dueAt: isoOf(f.reassignDeadline),
        link: `/vehicles/${enc(f.vehicleId)}?tab=fines`,
      });
    }
    return out;
  }

  /** dealTransfer (completed sales whose ownership transfer is not DONE). */
  private async deals(h: Horizons): Promise<FeedCandidate[]> {
    if (!h.dealTransfer) return [];
    const rows = await this.prisma.deal.findMany({
      where: {
        type: { in: ['SALE', 'CONSIGNMENT_SALE'] },
        status: 'COMPLETED',
        transferStatus: { not: 'DONE' },
        transferDueAt: { not: null, lte: dbDate(h.dealTransfer) },
      },
      select: {
        id: true,
        dealNo: true,
        transferDueAt: true,
        vehicle: { select: VEHICLE_TITLE_SELECT },
        counterparty: { select: CONTACT_NAME_SELECT },
      },
    });
    const out: FeedCandidate[] = [];
    for (const d of rows) {
      if (!d.transferDueAt) continue;
      out.push({
        kind: 'dealTransfer',
        entityType: 'deal',
        entityId: d.id,
        title: `#${d.dealNo} · ${vehicleTitle(d.vehicle)}`,
        subtitle: contactDisplayName(d.counterparty) || null,
        dueAt: isoOf(d.transferDueAt),
        link: `/deals/${enc(d.id)}`,
      });
    }
    return out;
  }

  /** manual (Reminder rows not done). */
  private async manual(h: Horizons): Promise<FeedCandidate[]> {
    if (!h.manual) return [];
    const rows = await this.prisma.reminder.findMany({
      where: { doneAt: null, dueAt: { lte: dbDate(h.manual) } },
      select: { id: true, title: true, notes: true, dueAt: true, entityType: true, entityId: true },
    });
    return rows.map((r) => ({
      kind: 'manual' as const,
      entityType: 'reminder' as const,
      entityId: r.id,
      title: r.title,
      subtitle: r.notes ? truncate(r.notes, 120) : null,
      dueAt: isoOf(r.dueAt),
      link: reminderEntityLink(asEntityType(r.entityType), r.entityId),
    }));
  }
}
