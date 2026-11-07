import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toWire } from '../serialization/wire';

/** Fields never written to the audit log. */
const REDACTED_FIELDS = new Set([
  'passwordHash',
  'password',
  'currentPassword',
  'newPassword',
  'tokenVersion',
]);

type Row = Record<string, unknown>;

interface FindUniqueDelegate {
  findUnique(args: { where: { id: string | number } }): Promise<unknown>;
}

export interface AuditRecord {
  userId?: string | null;
  entity: string;
  entityId: string | number;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}

/** Wire-normalised, redacted copy of a row (Decimal -> number, Date -> string). */
function sanitize(value: unknown): Row | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const wire = toWire(value) as Row;
  const out: Row = {};
  for (const [k, v] of Object.entries(wire)) {
    if (!REDACTED_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function changedFields(before: Row, after: Row): Row {
  const changes: Row = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === 'updatedAt') continue;
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[key] = { from, to };
  }
  return changes;
}

/**
 * Writes `AuditLog` rows. Used by `AuditInterceptor` for `@Audited()` routes and callable
 * directly by services for actions that are not plain CRUD.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Loads the current row of `model` by id (null when unknown model / missing row). */
  async snapshot(model: string, id: string | number): Promise<Row | null> {
    const delegate = (this.prisma as unknown as Record<string, FindUniqueDelegate | undefined>)[
      model
    ];
    if (!delegate || typeof delegate.findUnique !== 'function') return null;
    try {
      return ((await delegate.findUnique({ where: { id } })) as Row | null) ?? null;
    } catch (e) {
      this.logger.warn(`Audit snapshot of ${model}#${id} failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** Persists one audit row; never throws (auditing must not break the request). */
  async record(entry: AuditRecord): Promise<void> {
    const before = sanitize(entry.before);
    const after = sanitize(entry.after);
    let diff: Row | null = null;
    if (entry.action === AuditAction.CREATE) diff = after ? { after } : null;
    else if (entry.action === AuditAction.DELETE) diff = before ? { before } : null;
    else if (before && after) diff = { changes: changedFields(before, after) };
    else if (after) diff = { after };

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          entity: entry.entity,
          entityId: String(entry.entityId),
          action: entry.action,
          diff: diff === null ? Prisma.DbNull : (diff as Prisma.InputJsonObject),
        },
      });
    } catch (e) {
      this.logger.error(
        `Failed to write audit log ${entry.entity}#${entry.entityId}: ${(e as Error).message}`,
      );
    }
  }
}
