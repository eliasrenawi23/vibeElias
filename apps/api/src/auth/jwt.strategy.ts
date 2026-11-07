import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env';
import { UsersService } from '../users/users.service';
import { ACCESS_COOKIE } from './auth.constants';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';

function fromAccessCookie(req: Request | undefined): string | null {
  const cookies = req?.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[ACCESS_COOKIE] ?? null;
}

/**
 * Reads the access JWT from the `rm_access` cookie and loads the user on every request, so a
 * logout / password change (`User.tokenVersion` bump) or deactivation takes effect immediately.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessCookie]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser | false> {
    if (payload.typ !== 'access' || typeof payload.sub !== 'string') return false;
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) return false;
    return this.users.toAuthenticated(user);
  }
}
