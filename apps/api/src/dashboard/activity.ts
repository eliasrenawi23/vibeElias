import { contactDisplayName, formatPlate, type AuditAction } from '@renawi/shared';

/*
 * Pure helpers of `GET /dashboard/activity`: changed fields of an audit diff, a display label
 * from a row snapshot, and the short English summary line.
 */

/** English display names of the audited entities (Prisma model names). */
export const ACTIVITY_ENTITY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  Vehicle: 'Vehicle',
  Contact: 'Contact',
  Driver: 'Driver',
  TaxiLicense: 'Taxi licence',
  LeaseContract: 'Lease',
  Deal: 'Deal',
  DealPayment: 'Deal payment',
  TrafficFine: 'Fine',
  VehicleExpense: 'Expense',
  InsurancePolicy: 'Insurance policy',
  InventoryCycle: 'Inventory cycle',
  OdometerLog: 'Odometer reading',
  LedgerEntry: 'Ledger entry',
  Document: 'Document',
  Reminder: 'Reminder',
  Settings: 'Settings',
  User: 'User',
});

/** Fields that never count as a change worth showing. */
const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt']);

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

/** Changed field names of an UPDATE diff (`{ changes: { field: { from, to } } }`). */
export function changedFields(action: AuditAction, diff: unknown): string[] {
  if (action !== 'UPDATE') return [];
  const changes = asObject(asObject(diff)?.changes);
  return changes ? Object.keys(changes).filter((k) => !IGNORED_FIELDS.has(k)) : [];
}

/** The row snapshot stored in a diff (`after` of a CREATE, `before` of a DELETE). */
export function snapshotOf(diff: unknown): Json | null {
  const d = asObject(diff);
  return asObject(d?.after) ?? asObject(d?.before);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Display label of an entity from a row snapshot (null when the snapshot has nothing usable). */
export function labelFromSnapshot(entity: string, row: Json | null): string | null {
  if (!row) return null;
  switch (entity) {
    case 'Vehicle': {
      const plate = str(row.plateNo);
      return plate ? formatPlate(plate) : null;
    }
    case 'Deal':
      return typeof row.dealNo === 'number' ? `#${row.dealNo}` : null;
    case 'LeaseContract':
      return typeof row.contractNo === 'number' ? `#${row.contractNo}` : null;
    case 'TaxiLicense':
      return str(row.licenseNo);
    case 'Contact':
      return (
        contactDisplayName({
          firstName: str(row.firstName),
          lastName: str(row.lastName),
          companyName: str(row.companyName),
        }) || null
      );
    case 'Document':
      return str(row.title) ?? str(row.fileName);
    case 'Reminder':
    case 'User':
      return str(row.title) ?? str(row.name);
    case 'TrafficFine':
      return str(row.fineNo);
    case 'InsurancePolicy':
      return str(row.policyNo) ?? str(row.insurer);
    default:
      return null;
  }
}

export interface ActivitySummaryInput {
  entity: string;
  action: AuditAction;
  label: string | null;
  changes: readonly string[];
  diff: unknown;
}

function changeTo(diff: unknown, field: string): unknown {
  const change = asObject(asObject(asObject(diff)?.changes)?.[field]);
  return change ? change.to : undefined;
}

/**
 * Short English summary of an audit row, e.g. `Vehicle 84-731-26 created`,
 * `Deal #12 status → COMPLETED`, `Contact Dana Levi updated: phones, followUpAt`,
 * `Reminder Call the buyer marked done`, `Expense deleted`.
 */
export function buildActivitySummary(i: ActivitySummaryInput): string {
  const name = ACTIVITY_ENTITY_NAMES[i.entity] ?? i.entity;
  const subject = i.label ? `${name} ${i.label}` : name;
  if (i.action === 'CREATE') return `${subject} created`;
  if (i.action === 'DELETE') return `${subject} deleted`;
  if (i.changes.includes('status')) {
    const to = changeTo(i.diff, 'status');
    if (typeof to === 'string') {
      const more = i.changes.length - 1;
      return `${subject} status → ${to}${more > 0 ? ` (+${more} more)` : ''}`;
    }
  }
  if (i.entity === 'Reminder' && i.changes.length === 1 && i.changes[0] === 'doneAt') {
    return changeTo(i.diff, 'doneAt') ? `${subject} marked done` : `${subject} reopened`;
  }
  if (i.changes.length === 0) return `${subject} updated`;
  const shown = i.changes.slice(0, 3).join(', ');
  const rest = i.changes.length - 3;
  return `${subject} updated: ${shown}${rest > 0 ? ` +${rest} more` : ''}`;
}
