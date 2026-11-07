import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';

export const AUDIT_METADATA = 'renawi:audit';

export interface AuditOptions {
  /** Route param holding the entity id (default `id`). */
  idParam?: string;
  /** Fixed entity id for singletons (e.g. `Settings` row `1`). */
  entityId?: string | number;
  /** Use the authenticated user's id as the entity id (e.g. `PATCH /auth/me`). */
  idFromUser?: boolean;
  /** Prisma model delegate used for before/after snapshots (default: entity in lowerCamelCase). */
  model?: string;
  /** Override the action derived from the HTTP method (e.g. `POST /leases/:id/end` = UPDATE). */
  action?: AuditAction;
  /**
   * Take the entity id from the handler result even though the route has an `:id` param that
   * belongs to a parent (e.g. `POST /vehicles/:id/expenses` creates a VehicleExpense).
   */
  idFromResult?: boolean;
}

export interface AuditMetadata extends AuditOptions {
  entity: string;
}

/**
 * Marks a controller or handler as audited: successful POST/PUT/PATCH/DELETE requests write an
 * `AuditLog` row (`CREATE`/`UPDATE`/`DELETE` with a field diff). Usage:
 *
 *   @Audited('Vehicle')                         // POST /vehicles, PATCH /vehicles/:id, ...
 *   @Audited('Settings', { entityId: 1 })      // singleton
 */
export const Audited = (entity: string, options: AuditOptions = {}) =>
  SetMetadata(AUDIT_METADATA, { entity, ...options } satisfies AuditMetadata);
