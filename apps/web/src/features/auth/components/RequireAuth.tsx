import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { FullPageSpinner } from '../../../shared/ui/FullPageSpinner';

/** Route guard: renders its children only with a session, otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status, error, retry } = useAuth();
  const location = useLocation();
  const errorMessage = useErrorMessage();

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'error') {
    return (
      <Result
        status="warning"
        title={errorMessage(error)}
        extra={
          <Button type="primary" onClick={retry}>
            {t('actions.retry')}
          </Button>
        }
      />
    );
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
