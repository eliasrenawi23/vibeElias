import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Flex, Result, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../../shared/lib/i18n';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { fetchSettings, updateSettings } from '../api';
import { BusinessSettingsForm } from '../forms/BusinessSettingsForm';
import { settingsKeys } from '../queryKeys';

/** `/settings/business`: business identity printed on contracts and forms. */
export function BusinessSettingsPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();

  const query = useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: ({ signal }) => fetchSettings(signal),
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.detail(), saved);
      void message.success(t('common.saved'));
    },
    onError: (error) => {
      void message.error(errorMessage(error));
    },
  });

  return (
    <Flex vertical gap={16} className="rm-settings-page">
      <PageHeader subtitle={t('settings.business.description')} />
      {query.isPending ? (
        <Card variant="borderless">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      ) : query.isError ? (
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
      ) : (
        <BusinessSettingsForm
          settings={query.data}
          onSave={(values) => mutation.mutateAsync(values)}
          saving={mutation.isPending}
        />
      )}
    </Flex>
  );
}
