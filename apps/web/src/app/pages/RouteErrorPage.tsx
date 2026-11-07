import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { NotFoundPage } from './NotFoundPage';

/** Router `errorElement`: unexpected render errors and unmatched loader responses. */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (import.meta.env.DEV) console.error(error);
  return (
    <Result
      status="error"
      title={t('errors.generic')}
      extra={
        <Button type="primary" onClick={() => window.location.reload()}>
          {t('actions.retry')}
        </Button>
      }
    />
  );
}
