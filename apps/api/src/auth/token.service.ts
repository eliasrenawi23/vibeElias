import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parseDurationMs } from '../config/duration';
import type { Env } from '../config/env';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';

interface TokenSubject {
  id: string;
  tokenVersion: number;
}

/** Signs and verifies the access / refresh JWTs (HS256, separate secrets). */
@Injectable()
export class TokenService {
  readonly accessTtlMs: number;
  readonly refreshTtlMs: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlMs = parseDurationMs(config.get('ACCESS_TTL', { infer: true }));
    this.refreshTtlMs = parseDurationMs(config.get('REFRESH_TTL', { infer: true }));
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
  }

  signAccess(user: TokenSubject): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, tv: user.tokenVersion, typ: 'access' };
    return this.jwt.signAsync(payload, {
      secret: this.accessSecret,
      algorithm: 'HS256',
      expiresIn: Math.floor(this.accessTtlMs / 1000),
    });
  }

  signRefresh(user: TokenSubject): Promise<string> {
    const payload: Omit<RefreshTokenPayload, 'jti'> = {
      sub: user.id,
      tv: user.tokenVersion,
      typ: 'refresh',
    };
    return this.jwt.signAsync(payload, {
      secret: this.refreshSecret,
      algorithm: 'HS256',
      expiresIn: Math.floor(this.refreshTtlMs / 1000),
      jwtid: randomUUID(),
    });
  }

  /** Verified refresh claims, or null when missing / invalid / expired / wrong type. */
  async verifyRefresh(token: string | undefined): Promise<RefreshTokenPayload | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
        algorithms: ['HS256'],
      });
      return payload.typ === 'refresh' && typeof payload.jti === 'string' ? payload : null;
    } catch {
      return null;
    }
  }

  /**
   * Verified access claims, or null. `ignoreExpiration` is used by logout only, to identify
   * whose sessions to end even when the 15-minute token has just expired.
   */
  async verifyAccess(
    token: string | undefined,
    options: { ignoreExpiration?: boolean } = {},
  ): Promise<AccessTokenPayload | null> {
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessSecret,
        algorithms: ['HS256'],
        ignoreExpiration: options.ignoreExpiration ?? false,
      });
      return payload.typ === 'access' ? payload : null;
    } catch {
      return null;
    }
  }
}
