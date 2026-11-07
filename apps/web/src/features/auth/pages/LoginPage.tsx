import { Alert, Card, Flex, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, type Location } from 'react-router';
import { LangMenu } from '../../../app/layout/LangMenu';
import { ThemeToggle } from '../../../app/layout/ThemeToggle';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useUi } from '../../../app/providers/UiProvider';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { BrandLogo } from '../../../shared/ui/BrandLogo';
import { LoginForm } from '../forms/LoginForm';

/** Where to go after logging in: the page that sent us here, never back to /login. */
function redirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from;
  if (!from || from.pathname === '/login') return '/';
  return `${from.pathname}${from.search}${from.hash}`;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { status, login, sessionExpired } = useAuth();
  const { themeMode } = useUi();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const target = redirectTarget(location.state);

  // A successful login stores the session, which flips `status` and redirects below.
  const mutation = useMutation({ mutationFn: login });

  if (status === 'authenticated') return <Navigate to={target} replace />;

  return (
    <main className="rm-login">
      <Flex className="rm-login-tools" gap={4} justify="flex-end">
        <LangMenu />
        <ThemeToggle />
      </Flex>
      <Card className="rm-login-card" variant="borderless">
        <Flex vertical gap={20}>
          <Flex justify="center">
            <BrandLogo variant="horizontal" onDark={themeMode === 'dark'} height={36} />
          </Flex>
          <div className="rm-login-heading">
            <Typography.Title level={1}>{t('auth.loginTitle')}</Typography.Title>
            <Typography.Text type="secondary">{t('auth.loginSubtitle')}</Typography.Text>
          </div>
          {sessionExpired && !mutation.error && (
            <Alert type="info" showIcon title={t('auth.sessionExpired')} />
          )}
          <LoginForm
            onSubmit={(values) => mutation.mutate(values)}
            submitting={mutation.isPending}
            error={mutation.error ? errorMessage(mutation.error) : undefined}
          />
        </Flex>
      </Card>
    </main>
  );
}
