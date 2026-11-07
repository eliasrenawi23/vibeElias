import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import {
  Theme,
  toLocale,
  type AuthUser,
  type Paginated,
  type UserCreate,
  type UserQuery,
  type UserUpdate,
} from '@renawi/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { hashPassword } from '../auth/password';
import { AppException } from '../common/errors/app-exception';
import { PrismaService } from '../prisma/prisma.service';

/** User as returned by the `/users` admin endpoints (never includes the password hash). */
export interface UserView extends AuthUser {
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'email', 'name', 'role']);

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public projection used by `/auth/*` responses. */
  toAuthUser(user: User): AuthUser {
    const theme = Theme.safeParse(user.theme);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      locale: toLocale(user.locale),
      theme: theme.success ? theme.data : 'system',
    };
  }

  toAuthenticated(user: User): AuthenticatedUser {
    return { ...this.toAuthUser(user), tokenVersion: user.tokenVersion };
  }

  toView(user: User): UserView {
    return {
      ...this.toAuthUser(user),
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async getById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw AppException.notFound();
    return user;
  }

  async list(query: UserQuery): Promise<Paginated<UserView>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sort = query.sort && SORTABLE_FIELDS.has(query.sort) ? query.sort : 'createdAt';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { [sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      items: rows.map((u) => this.toView(u)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(dto: UserCreate): Promise<UserView> {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        locale: dto.locale,
        theme: dto.theme,
        isActive: dto.isActive,
        passwordHash: await hashPassword(dto.password),
      },
    });
    return this.toView(user);
  }

  /** Admin edit; a password reset or deactivation also ends the user's sessions. */
  async update(id: string, dto: UserUpdate): Promise<UserView> {
    await this.getById(id);
    const endSessions = dto.password !== undefined || dto.isActive === false;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        locale: dto.locale,
        theme: dto.theme,
        isActive: dto.isActive,
        ...(dto.password !== undefined ? { passwordHash: await hashPassword(dto.password) } : {}),
        ...(endSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
    });
    return this.toView(user);
  }
}
