import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';
import { from, mergeMap, Observable, switchMap } from 'rxjs';
import { AUDIT_METADATA, AuditMetadata } from './audit.decorator';
import { AuditService } from './audit.service';

const METHOD_ACTIONS: Record<string, AuditAction> = {
  POST: AuditAction.CREATE,
  PUT: AuditAction.UPDATE,
  PATCH: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
};

type RequestWithUser = Request & { user?: { id?: string } };

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Finds the created entity's id in a handler result (`{ id }` or `{ <anything>: { id } }`). */
function idFromResult(result: unknown): string | number | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const r = result as Record<string, unknown>;
  if (typeof r.id === 'string' || typeof r.id === 'number') return r.id;
  for (const value of Object.values(r)) {
    if (value && typeof value === 'object') {
      const id = (value as Record<string, unknown>).id;
      if (typeof id === 'string' || typeof id === 'number') return id;
    }
  }
  return undefined;
}

/**
 * Global interceptor writing `AuditLog` rows for successful mutating requests on routes marked
 * with `@Audited()`. UPDATE/DELETE load a "before" snapshot first; CREATE/UPDATE load the
 * "after" row once the handler succeeded, so the diff reflects the database, not the response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const meta = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const methodAction = METHOD_ACTIONS[req.method.toUpperCase()];
    if (!meta || !methodAction) return next.handle();

    const model = meta.model ?? lowerFirst(meta.entity);
    const params = (req.params ?? {}) as Record<string, string | undefined>;
    const knownId: string | number | undefined = meta.idFromResult
      ? undefined
      : (meta.entityId ?? (meta.idFromUser ? req.user?.id : params[meta.idParam ?? 'id']));
    // POST on an existing entity (e.g. /contacts/:id/archive) is an update, not a create.
    const action =
      meta.action ??
      (methodAction === AuditAction.CREATE && knownId !== undefined
        ? AuditAction.UPDATE
        : methodAction);
    const userId = req.user?.id ?? null;

    const before$ =
      knownId !== undefined && action !== AuditAction.CREATE
        ? from(this.audit.snapshot(model, knownId))
        : from(Promise.resolve(null));

    return before$.pipe(
      switchMap((before) =>
        next.handle().pipe(
          mergeMap(async (result: unknown) => {
            const entityId = knownId ?? idFromResult(result);
            if (entityId !== undefined) {
              const after =
                action === AuditAction.DELETE ? null : await this.audit.snapshot(model, entityId);
              await this.audit.record({
                userId,
                entity: meta.entity,
                entityId,
                action,
                before,
                after: after ?? (action === AuditAction.DELETE ? null : result),
              });
            }
            return result;
          }),
        ),
      ),
    );
  }
}
