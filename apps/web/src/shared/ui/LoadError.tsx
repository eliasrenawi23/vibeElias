import { Button, Result } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isApiError } from '../lib/http';
import { useErrorMessage } from '../lib/i18n';

export interface LoadErrorProps {
  error: unknown;
  title?: ReactNode;
  /** Title for a 404 response. */
  notFoundTitle?: ReactNode;
  onRetry?: () => void;
  extra?: ReactNode;
}

/** Failed query: 404 as "not found", anything else as a warning with a retry button. */
export function LoadError({ error, title, notFoundTitle, onRetry, extra }: LoadErrorProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const notFound = isApiError(error) && error.status === 404;
  return (
    <Result
      status={notFound ? '404' : 'warning'}
      title={notFound ? (notFoundTitle ?? t('errors.notFound')) : (title ?? t('common.loadError'))}
      subTitle={notFound ? undefined : errorMessage(error)}
      extra={
        <>
          {!notFound && onRetry && (
            <Button type="primary" onClick={onRetry}>
              {t('actions.retry')}
            </Button>
          )}
          {extra}
        </>
      }
    />
  );
}
