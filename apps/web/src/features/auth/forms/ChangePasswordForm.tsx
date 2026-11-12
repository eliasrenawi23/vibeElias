import {
  MeUpdateSchema,
  password,
  PASSWORD_MIN_LENGTH,
  type AuthUser,
  type MeUpdate,
} from '@renawi/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useFormErrors } from '../../../shared/form/useFormErrors';
import { useZodForm } from '../../../shared/form/useZodForm';
import { isolateLtr } from '../../../shared/lib/bidi';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormTextField } from '../../../shared/ui/FormTextField';
import { updateMe } from '../api';

/**
 * Change-password form: the current password, the new one (the shared password policy of
 * `MeUpdateSchema`) and its confirmation, which must match and differ from the current one.
 */
export const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'validation.currentPasswordRequired').max(128),
    newPassword: password,
    confirmPassword: z.string().min(1, 'validation.required').max(128),
  })
  .superRefine((v, ctx) => {
    if (v.confirmPassword && v.newPassword !== v.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'auth.passwordMismatch',
      });
    }
    if (v.newPassword && v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newPassword'],
        message: 'auth.passwordUnchanged',
      });
    }
  });
export type ChangePasswordValues = z.input<typeof ChangePasswordFormSchema>;

const EMPTY: ChangePasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** `PATCH /auth/me` body of a password change (validated by the same shared schema as the API). */
export function changePasswordBody(values: { currentPassword: string; newPassword: string }) {
  return MeUpdateSchema.parse({
    currentPassword: values.currentPassword,
    newPassword: values.newPassword,
  });
}

export interface ChangePasswordFormProps {
  /** After the API accepted the change (this browser got a fresh session). */
  onChanged: (user: AuthUser) => void;
}

/**
 * The API checks the current password (a wrong one comes back as a field error on it), stores
 * the new one and bumps the account's token version: every other signed-in device has to sign in
 * again, this one stays signed in with new cookies.
 */
export function ChangePasswordForm({ onChanged }: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const form = useZodForm(ChangePasswordFormSchema, { defaultValues: EMPTY });
  const { formError, handleError, clearFormError } = useFormErrors(form.setError, {
    fields: ['currentPassword', 'newPassword', 'confirmPassword'],
  });
  const mutation = useMutation({ mutationFn: (body: MeUpdate) => updateMe(body) });

  const submit = form.handleSubmit(async (values) => {
    clearFormError();
    try {
      const user = await mutation.mutateAsync(changePasswordBody(values));
      form.reset(EMPTY);
      onChanged(user);
    } catch (error) {
      handleError(error);
      // "Invalid email or password" reads oddly on this field: say which password is wrong.
      if (form.getFieldState('currentPassword').error?.message === 'auth.invalidCredentials') {
        form.setError('currentPassword', { type: 'server', message: 'auth.wrongCurrentPassword' });
      }
    }
  });

  return (
    <FormLayout onSubmit={submit} aria-label={t('auth.changePassword')}>
      <Flex vertical gap={4} data-testid="change-password-form">
        {formError && (
          <Alert type="error" showIcon title={formError} className="rm-dialog-error" />
        )}
        <FormTextField
          control={form.control}
          name="currentPassword"
          type="password"
          label={t('auth.currentPassword')}
          required
          inputProps={{ autoComplete: 'current-password' }}
        />
        <FormTextField
          control={form.control}
          name="newPassword"
          type="password"
          label={t('auth.newPassword')}
          required
          help={t('auth.passwordPolicy', { min: isolateLtr(String(PASSWORD_MIN_LENGTH)) })}
          inputProps={{ autoComplete: 'new-password' }}
        />
        <FormTextField
          control={form.control}
          name="confirmPassword"
          type="password"
          label={t('auth.confirmPassword')}
          required
          inputProps={{ autoComplete: 'new-password' }}
        />
        <Typography.Paragraph type="secondary" data-testid="change-password-note">
          {t('auth.otherSessionsNote')}
        </Typography.Paragraph>
        <Flex justify="flex-end">
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            data-testid="change-password-submit"
          >
            {t('auth.changePassword')}
          </Button>
        </Flex>
      </Flex>
    </FormLayout>
  );
}
