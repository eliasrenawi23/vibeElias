import { CloudServerOutlined, ReloadOutlined } from '@ant-design/icons';
import { BACKUP_MAX_AGE_HOURS } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Flex, Result, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { Ltr } from '../../../shared/lib/bidi';
import { DateTimeText } from '../../../shared/ui/DateTimeText';
import { DESCRIPTION_COLUMNS_SINGLE } from '../../../shared/ui/descriptionColumns';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ToneTag } from '../../../shared/ui/ToneTag';
import { fetchBackupStatus } from '../api';
import { settingsKeys } from '../queryKeys';

/** `/settings/backup`: when the nightly backup last succeeded, and whether that is recent enough. */
export function BackupSettingsPage() {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: settingsKeys.backup(),
    queryFn: ({ signal }) => fetchBackupStatus(signal),
  });
  const refresh = (
    <Button
      icon={<ReloadOutlined />}
      onClick={() => void query.refetch()}
      loading={query.isFetching}
      data-testid="backup-refresh"
    >
      {t('actions.refresh')}
    </Button>
  );

  let body;
  if (query.isPending) {
    body = (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  } else if (query.isError) {
    body = (
      <LoadError
        error={query.error}
        title={t('settings.backup.loadError')}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (query.data === null) {
    body = (
      <Result
        icon={<CloudServerOutlined />}
        title={t('settings.backup.notConfigured')}
        subTitle={t('settings.backup.notConfiguredHint')}
        data-testid="backup-not-configured"
      />
    );
  } else {
    const status = query.data;
    const never = !status.lastSuccessAt;
    const tone = status.ok ? 'success' : never ? 'warning' : 'error';
    const label = status.ok
      ? t('settings.backup.ok')
      : never
        ? t('settings.backup.never')
        : t('settings.backup.stale');
    body = (
      <Card variant="borderless" data-testid="backup-status">
        <Flex vertical gap={16}>
          <Alert
            type={status.ok ? 'success' : never ? 'warning' : 'error'}
            showIcon
            title={
              status.ok
                ? t('settings.backup.okHint', { hours: BACKUP_MAX_AGE_HOURS })
                : never
                  ? t('settings.backup.never')
                  : t('settings.backup.staleHint', { hours: BACKUP_MAX_AGE_HOURS })
            }
          />
          <Descriptions
            column={DESCRIPTION_COLUMNS_SINGLE}
            items={[
              {
                key: 'status',
                label: t('settings.backup.status'),
                children: (
                  <ToneTag tone={tone} data-ok={status.ok}>
                    {label}
                  </ToneTag>
                ),
              },
              {
                key: 'last',
                label: t('settings.backup.lastSuccess'),
                children: <DateTimeText value={status.lastSuccessAt} />,
              },
              {
                key: 'file',
                label: t('settings.backup.lastFile'),
                children: status.lastFile ? (
                  <Ltr tabular={false}>{status.lastFile}</Ltr>
                ) : (
                  <span className="rm-empty-value">—</span>
                ),
              },
            ]}
          />
        </Flex>
      </Card>
    );
  }

  return (
    <Flex vertical gap={16} className="rm-settings-page">
      <PageHeader subtitle={t('settings.backup.description')} extra={refresh} />
      {body}
    </Flex>
  );
}
