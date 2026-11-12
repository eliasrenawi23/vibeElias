import type { SettingsResponse } from '@renawi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../shared/lib/i18n';
import { fetchSettings, updateSettings } from './api';
import { settingsKeys } from './queryKeys';

/** `GET /settings` (shared by every settings page). */
export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: ({ signal }) => fetchSettings(signal),
  });
}

/**
 * `PATCH /settings`: on success the saved settings replace the cached ones, `refresh` keys are
 * invalidated (e.g. the reminders feed after the lead days change) and "Saved" is shown.
 */
export function useSaveSettings(refresh: readonly (readonly unknown[])[] = []) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.detail(), saved);
      for (const key of refresh) void queryClient.invalidateQueries({ queryKey: key });
      void message.success(t('common.saved'));
    },
    onError: (error) => void message.error(errorMessage(error)),
  });
}

/** Loading skeleton / load error with retry / the form once the settings are in. */
export function SettingsGate({
  query,
  children,
}: {
  query: ReturnType<typeof useSettingsQuery>;
  children: (settings: SettingsResponse) => ReactNode;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }
  if (query.isError) {
    return (
      <Result
        status="warning"
        title={t('settings.business.loadError')}
        subTitle={errorMessage(query.error)}
        extra={
          <Button type="primary" onClick={() => void query.refetch()}>
            {t('actions.retry')}
          </Button>
        }
      />
    );
  }
  return <>{children(query.data)}</>;
}
