import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app-exception';
import { ROLES_KEY } from '../auth.constants';
import type { AuthenticatedUser } from '../auth.types';

/** Global guard enforcing `@Roles(...)` (runs after `JwtAuthGuard`). No metadata = any role. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>().user;
    if (!user) throw AppException.unauthorized();
    if (!roles.includes(user.role)) throw AppException.forbidden();
    return true;
  }
}
