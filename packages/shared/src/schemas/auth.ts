import { z } from 'zod';
import { Locale, Role, Theme } from '../enums.js';
import { msg } from '../messages.js';
import { email, idString, requiredText } from '../primitives.js';

/** Password policy: 8-128 characters with at least one letter and one digit. */
export const PASSWORD_MIN_LENGTH = 8;
export const password = z
  .string({ required_error: msg.required })
  .min(PASSWORD_MIN_LENGTH)
  .max(128)
  .refine((v) => /\p{L}/u.test(v) && /\d/.test(v), { message: msg.passwordTooWeak });

/** `POST /auth/login` body. The password is not policy-checked here (only presence). */
export const LoginSchema = z.object({
  email,
  password: z.string({ required_error: msg.required }).min(1).max(128),
});
export type Login = z.infer<typeof LoginSchema>;
export type LoginInput = z.input<typeof LoginSchema>;

/** User as returned by `POST /auth/login`, `POST /auth/refresh` and `GET /auth/me`. */
export const AuthUserSchema = z.object({
  id: idString,
  email: z.string(),
  name: z.string(),
  role: Role,
  locale: Locale,
  theme: Theme,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

/** Response of login / refresh / me. Tokens travel only in httpOnly cookies. */
export const AuthSessionSchema = z.object({
  user: AuthUserSchema,
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

/**
 * `PATCH /auth/me`: profile preferences and optional password change.
 * Changing the password requires `currentPassword` and bumps `User.tokenVersion` server-side.
 */
export const MeUpdateSchema = z
  .object({
    name: requiredText(100).optional(),
    locale: Locale.optional(),
    theme: Theme.optional(),
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: password.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword !== undefined && !v.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentPassword'],
        message: msg.currentPasswordRequired,
      });
    }
  });
export type MeUpdate = z.infer<typeof MeUpdateSchema>;
export type MeUpdateInput = z.input<typeof MeUpdateSchema>;
