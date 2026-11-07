import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthUser, Login, MeUpdate } from '@renawi/shared';
import { AppException, ErrorKey } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser, IssuedSession } from './auth.types';
import { hashPassword, verifyPassword } from './password';
import { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash verified for unknown e-mails so both failure paths cost the same time. */
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly refreshStore: RefreshTokenStore,
  ) {
    this.dummyHash = hashPassword(randomBytes(24).toString('base64url'));
  }

  /** Verifies e-mail + password; 401 `auth.invalidCredentials` on any mismatch. */
  async login(dto: Login): Promise<IssuedSession> {
    const user = await this.users.findByEmail(dto.email);
    const ok =
      user && user.isActive
        ? await verifyPassword(user.passwordHash, dto.password)
        : (await verifyPassword(await this.dummyHash, dto.password)) && false;
    if (!user || !ok) throw AppException.unauthorized(ErrorKey.invalidCredentials);
    return this.issue(user);
  }

  /**
   * Exchanges a refresh token for a new access + refresh pair (rotation). The presented token
   * is single-use; it is rejected when reused, expired, or issued before the last logout /
   * password change (`tokenVersion` mismatch).
   */
  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    const payload = await this.tokens.verifyRefresh(refreshToken);
    if (!payload) throw AppException.unauthorized(ErrorKey.sessionExpired);
    if (!this.refreshStore.consume(payload.jti, payload.exp)) {
      this.logger.warn(`Rejected reuse of a rotated refresh token for user ${payload.sub}`);
      throw AppException.unauthorized(ErrorKey.sessionExpired);
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      throw AppException.unauthorized(ErrorKey.sessionExpired);
    }
    return this.issue(user);
  }

  /**
   * Ends all sessions of the user identified by the refresh or (possibly expired) access token
   * by incrementing `tokenVersion`. Unknown / invalid tokens are ignored (logout is idempotent).
   */
  async logout(tokens: { accessToken?: string; refreshToken?: string }): Promise<void> {
    const claims =
      (await this.tokens.verifyRefresh(tokens.refreshToken)) ??
      (await this.tokens.verifyAccess(tokens.accessToken, { ignoreExpiration: true }));
    if (!claims) return;
    await this.prisma.user.updateMany({
      where: { id: claims.sub, tokenVersion: claims.tv },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  /**
   * Updates the current user's preferences; a password change needs `currentPassword`, bumps
   * `tokenVersion` (other devices are logged out) and returns a fresh session for this device.
   */
  async updateMe(
    current: AuthenticatedUser,
    dto: MeUpdate,
  ): Promise<{ user: AuthUser; session?: IssuedSession }> {
    const existing = await this.users.getById(current.id);
    let passwordHash: string | undefined;
    if (dto.newPassword !== undefined) {
      const ok = await verifyPassword(existing.passwordHash, dto.currentPassword ?? '');
      if (!ok) throw AppException.fieldError('currentPassword', ErrorKey.invalidCredentials);
      passwordHash = await hashPassword(dto.newPassword);
    }
    const user = await this.prisma.user.update({
      where: { id: current.id },
      data: {
        name: dto.name,
        locale: dto.locale,
        theme: dto.theme,
        ...(passwordHash ? { passwordHash, tokenVersion: { increment: 1 } } : {}),
      },
    });
    if (passwordHash) {
      const session = await this.issue(user);
      return { user: session.user, session };
    }
    return { user: this.users.toAuthUser(user) };
  }

  private async issue(user: User): Promise<IssuedSession> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccess(user),
      this.tokens.signRefresh(user),
    ]);
    return { user: this.users.toAuthUser(user), accessToken, refreshToken };
  }
}
