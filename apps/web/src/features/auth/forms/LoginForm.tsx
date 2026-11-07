import { LoginSchema, type Login } from '@renawi/shared';
import { Alert, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useZodForm } from '../../../shared/form/useZodForm';
import { ltrInputProps } from '../../../shared/lib/bidi';
import { FormLayout } from '../../../shared/ui/FormLayout';
import { FormTextField } from '../../../shared/ui/FormTextField';

export interface LoginFormProps {
  onSubmit: (values: Login) => void;
  submitting: boolean;
  /** Translated error to show above the button (e.g. invalid credentials). */
  error?: string;
}

export function LoginForm({ onSubmit, submitting, error }: LoginFormProps) {
  const { t } = useTranslation();
  const form = useZodForm(LoginSchema, { defaultValues: { email: '', password: '' } });

  return (
    <FormLayout onSubmit={form.handleSubmit(onSubmit)} aria-label={t('auth.login')}>
      <FormTextField
        control={form.control}
        name="email"
        type="email"
        label={t('auth.email')}
        required
        inputProps={{ ...ltrInputProps, autoComplete: 'username', autoFocus: true, size: 'large' }}
      />
      <FormTextField
        control={form.control}
        name="password"
        type="password"
        label={t('auth.password')}
        required
        inputProps={{ ...ltrInputProps, autoComplete: 'current-password', size: 'large' }}
      />
      {error && (
        <Alert type="error" showIcon title={error} role="alert" className="rm-login-error" />
      )}
      <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
        {t('auth.login')}
      </Button>
    </FormLayout>
  );
}
