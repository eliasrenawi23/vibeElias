import { Injectable } from '@nestjs/common';
import { contactDisplayName, formatPlate, type ActivityItem } from '@renawi/shared';
import { CONTACT_NAME_SELECT } from '../common/refs';
import { PrismaService } from '../prisma/prisma.service';
import { reminderEntityLink } from '../reminders/feed-rules';
import { asEntityType } from '../reminders/reminders-feed.service';
import { buildActivitySummary, changedFields, labelFromSnapshot, snapshotOf } from './activity';

/** Current label + SPA link of an audited entity. */
interface Ref {
  label: string | null;
  link: string | null;
}

const enc = encodeURIComponent;

/** `GET /dashboard/activity`: the latest audit rows with a label, summary and link. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async recent(limit: number): Promise<ActivityItem[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: [{ at: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        at: true,
        entity: true,
        entityId: true,
        action: true,
        diff: true,
        user: { select: { name: true } },
      },
    });
    const refs = await this.resolve(rows);
    return rows.map((r) => {
      const ref = refs.get(`${r.entity}:${r.entityId}`);
      const label = ref?.label ?? labelFromSnapshot(r.entity, snapshotOf(r.diff));
      const changes = changedFields(r.action, r.diff);
      return {
        id: r.id,
        at: r.at.toISOString(),
        userName: r.user?.name ?? null,
        entity: r.entity,
        entityId: r.entityId,
        action: r.action,
        summary: buildActivitySummary({
          entity: r.entity,
          action: r.action,
          label,
          changes,
          diff: r.diff,
        }),
        label,
        changes,
        link: ref?.link ?? (r.entity === 'Settings' ? '/settings/business' : null),
      };
    });
  }

  /** Batch lookups of the entities still present (deleted rows fall back to the diff). */
  private async resolve(rows: { entity: string; entityId: string }[]): Promise<Map<string, Ref>> {
    const ids = new Map<string, string[]>();
    for (const r of rows) ids.set(r.entity, [...(ids.get(r.entity) ?? []), r.entityId]);
    const of = (entity: string) => ({ in: [...new Set(ids.get(entity) ?? [])] });
    const has = (entity: string) => (ids.get(entity)?.length ?? 0) > 0;
    const out = new Map<string, Ref>();
    const put = (entity: string, id: string, ref: Ref) => out.set(`${entity}:${id}`, ref);
    const vehicleSel = { select: { plateNo: true } } as const;
    const plate = (v: { plateNo: string } | null | undefined) => (v ? formatPlate(v.plateNo) : null);

    const tasks: Promise<void>[] = [];
    if (has('Vehicle')) {
      tasks.push(
        this.prisma.vehicle
          .findMany({ where: { id: of('Vehicle') }, select: { id: true, plateNo: true } })
          .then((list) => {
            for (const v of list) {
              put('Vehicle', v.id, { label: formatPlate(v.plateNo), link: `/vehicles/${enc(v.id)}` });
            }
          }),
      );
    }
    if (has('Contact')) {
      tasks.push(
        this.prisma.contact
          .findMany({ where: { id: of('Contact') }, select: CONTACT_NAME_SELECT })
          .then((list) => {
            for (const c of list) {
              put('Contact', c.id, {
                label: contactDisplayName(c) || null,
                link: `/contacts/${enc(c.id)}`,
              });
            }
          }),
      );
    }
    if (has('Driver')) {
      tasks.push(
        this.prisma.driver
          .findMany({
            where: { id: of('Driver') },
            select: { id: true, contact: { select: CONTACT_NAME_SELECT } },
          })
          .then((list) => {
            for (const d of list) {
              put('Driver', d.id, {
                label: contactDisplayName(d.contact) || null,
                link: `/drivers/${enc(d.id)}`,
              });
            }
          }),
      );
    }
    if (has('TaxiLicense')) {
      tasks.push(
        this.prisma.taxiLicense
          .findMany({ where: { id: of('TaxiLicense') }, select: { id: true, licenseNo: true } })
          .then((list) => {
            for (const l of list) {
              put('TaxiLicense', l.id, { label: l.licenseNo, link: `/taxi-licenses/${enc(l.id)}` });
            }
          }),
      );
    }
    if (has('LeaseContract')) {
      tasks.push(
        this.prisma.leaseContract
          .findMany({
            where: { id: of('LeaseContract') },
            select: { id: true, contractNo: true },
          })
          .then((list) => {
            for (const c of list) {
              put('LeaseContract', c.id, { label: `#${c.contractNo}`, link: `/leases/${enc(c.id)}` });
            }
          }),
      );
    }
    if (has('Deal')) {
      tasks.push(
        this.prisma.deal
          .findMany({ where: { id: of('Deal') }, select: { id: true, dealNo: true } })
          .then((list) => {
            for (const d of list) {
              put('Deal', d.id, { label: `#${d.dealNo}`, link: `/deals/${enc(d.id)}` });
            }
          }),
      );
    }
    if (has('DealPayment')) {
      tasks.push(
        this.prisma.dealPayment
          .findMany({
            where: { id: of('DealPayment') },
            select: { id: true, dealId: true, deal: { select: { dealNo: true } } },
          })
          .then((list) => {
            for (const p of list) {
              put('DealPayment', p.id, {
                label: `#${p.deal.dealNo}`,
                link: `/deals/${enc(p.dealId)}`,
              });
            }
          }),
      );
    }
    if (has('TrafficFine')) {
      tasks.push(
        this.prisma.trafficFine
          .findMany({
            where: { id: of('TrafficFine') },
            select: { id: true, fineNo: true, vehicleId: true, vehicle: vehicleSel },
          })
          .then((list) => {
            for (const f of list) {
              put('TrafficFine', f.id, {
                label: f.fineNo ?? plate(f.vehicle),
                link: `/vehicles/${enc(f.vehicleId)}?tab=fines`,
              });
            }
          }),
      );
    }
    if (has('VehicleExpense')) {
      tasks.push(
        this.prisma.vehicleExpense
          .findMany({
            where: { id: of('VehicleExpense') },
            select: { id: true, vehicleId: true, vehicle: vehicleSel },
          })
          .then((list) => {
            for (const e of list) {
              put('VehicleExpense', e.id, {
                label: plate(e.vehicle),
                link: `/vehicles/${enc(e.vehicleId)}?tab=expenses`,
              });
            }
          }),
      );
    }
    if (has('InsurancePolicy')) {
      tasks.push(
        this.prisma.insurancePolicy
          .findMany({
            where: { id: of('InsurancePolicy') },
            select: { id: true, vehicleId: true, insurer: true, policyNo: true, vehicle: vehicleSel },
          })
          .then((list) => {
            for (const p of list) {
              put('InsurancePolicy', p.id, {
                label: p.vehicle ? plate(p.vehicle) : (p.policyNo ?? p.insurer),
                link: p.vehicleId
                  ? `/vehicles/${enc(p.vehicleId)}?tab=insurance`
                  : '/vehicles?tab=insurance',
              });
            }
          }),
      );
    }
    for (const entity of ['InventoryCycle', 'OdometerLog'] as const) {
      if (!has(entity)) continue;
      const query =
        entity === 'InventoryCycle'
          ? this.prisma.inventoryCycle.findMany({
              where: { id: of(entity) },
              select: { id: true, vehicleId: true, vehicle: vehicleSel },
            })
          : this.prisma.odometerLog.findMany({
              where: { id: of(entity) },
              select: { id: true, vehicleId: true, vehicle: vehicleSel },
            });
      tasks.push(
        query.then((list) => {
          for (const x of list) {
            put(entity, x.id, { label: plate(x.vehicle), link: `/vehicles/${enc(x.vehicleId)}` });
          }
        }),
      );
    }
    if (has('LedgerEntry')) {
      tasks.push(
        this.prisma.ledgerEntry
          .findMany({
            where: { id: of('LedgerEntry') },
            select: { id: true, driverId: true, driver: { select: { contact: { select: CONTACT_NAME_SELECT } } } },
          })
          .then((list) => {
            for (const e of list) {
              put('LedgerEntry', e.id, {
                label: contactDisplayName(e.driver.contact) || null,
                link: `/drivers/${enc(e.driverId)}?tab=ledger`,
              });
            }
          }),
      );
    }
    if (has('Document')) {
      tasks.push(
        this.prisma.document
          .findMany({
            where: { id: of('Document') },
            select: {
              id: true,
              title: true,
              fileName: true,
              vehicleId: true,
              driverId: true,
              contactId: true,
              dealId: true,
              contractId: true,
              taxiLicenseId: true,
            },
          })
          .then((list) => {
            for (const d of list) {
              const link = d.vehicleId
                ? `/vehicles/${enc(d.vehicleId)}?tab=documents`
                : d.driverId
                  ? `/drivers/${enc(d.driverId)}?tab=documents`
                  : d.contactId
                    ? `/contacts/${enc(d.contactId)}?tab=documents`
                    : d.dealId
                      ? `/deals/${enc(d.dealId)}?tab=documents`
                      : d.contractId
                        ? `/leases/${enc(d.contractId)}?tab=documents`
                        : d.taxiLicenseId
                          ? `/taxi-licenses/${enc(d.taxiLicenseId)}?tab=documents`
                          : null;
              put('Document', d.id, { label: d.title?.trim() || d.fileName, link });
            }
          }),
      );
    }
    if (has('Reminder')) {
      tasks.push(
        this.prisma.reminder
          .findMany({
            where: { id: of('Reminder') },
            select: { id: true, title: true, entityType: true, entityId: true },
          })
          .then((list) => {
            for (const r of list) {
              put('Reminder', r.id, {
                label: r.title,
                link: reminderEntityLink(asEntityType(r.entityType), r.entityId),
              });
            }
          }),
      );
    }
    if (has('User')) {
      tasks.push(
        this.prisma.user
          .findMany({ where: { id: of('User') }, select: { id: true, name: true } })
          .then((list) => {
            for (const u of list) put('User', u.id, { label: u.name, link: null });
          }),
      );
    }
    await Promise.all(tasks);
    return out;
  }
}
