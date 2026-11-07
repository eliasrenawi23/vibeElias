import { z } from 'zod';
import { Locale, Role, Theme } from '../enums.js';
import { email, pagination, querySearch, queryBool, requiredText } from '../primitives.js';
import { password } from './auth.js';

/** Staff user management (`/users`, ADMIN only). Single owner in v1; ready for staff. */
const UserBaseSchema = z.object({
  email,
  name: requiredText(100),
  role: Role.default('ADMIN'),
  locale: Locale.default('he'),
  theme: Theme.default('system'),
  isActive: z.boolean().default(true),
});

export const UserCreateSchema = UserBaseSchema.extend({ password });
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserCreateInput = z.input<typeof UserCreateSchema>;

/** Admin edit of a user; `password` resets it (and invalidates sessions). */
export const UserUpdateSchema = UserBaseSchema.extend({ password }).partial();
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserUpdateInput = z.input<typeof UserUpdateSchema>;

export const UserQuerySchema = pagination.extend({
  q: querySearch.optional(),
  role: Role.optional(),
  isActive: queryBool.optional(),
});
export type UserQuery = z.infer<typeof UserQuerySchema>;
