import { CloudServerOutlined, ReloadOutlined } from '@ant-design/icons';
import { BACKUP_MAX_AGE_HOURS, type BackupStatus } from '@renawi/shared';
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

export type BackupState = 'ok' | 'localOnly' | 'never' | 'stale';

const BACKUP_TONES = {
  ok: 'success',
  localOnly: 'warning',
  never: 'warning',
  stale: 'error',
} as const satisfies Record<BackupState, 'success' | 'warning' | 'error'>;

/**
 * A recent backup is ok when it was copied off the server (or the status file of an older
 * sidecar does not say), amber when it stays on this server only; none yet = amber; too old = red.
 */
export function backupState(status: BackupStatus): BackupState {
  if (status.ok) return status.offsite === false ? 'localOnly' : 'ok';
  return status.lastSuccessAt ? 'stale' : 'never';
}

/** Off-site copy: yes (with the bucket), no (this server only) or unknown (older status file). */
function OffsiteText({ status }: { status: BackupStatus }) {
  const { t } = useTranslation();
  if (status.offsite === true) {
    return (
      <Flex gap={6} align="center" wrap data-offsite="true">
        <ToneTag tone="success">{t('settings.backup.offsiteYes')}</ToneTag>
        {status.remote && <Ltr tabular={false}>{status.remote}</Ltr>}
      </Flex>
    );
  }
  if (status.offsite === false) {
    return (
      <ToneTag tone="warning" data-offsite="false">
        {t('settings.backup.offsiteNo')}
      </ToneTag>
    );
  }
  return (
    <span className="rm-empty-value" data-offsite="unknown">
      {t('settings.backup.offsiteUnknown')}
    </span>
  );
}

/**
 * `/settings/backup`: when the nightly backup last succeeded, whether that is recent enough, and
 * whether it was copied off the server.
 */
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
    const state = backupState(status);
    const tone = BACKUP_TONES[state];
    const label = {
      ok: t('settings.backup.ok'),
      localOnly: t('settings.backup.localOnly'),
      never: t('settings.backup.never'),
      stale: t('settings.backup.stale'),
    }[state];
    const hint = {
      ok: t('settings.backup.okHint', { hours: BACKUP_MAX_AGE_HOURS }),
      localOnly: t('settings.backup.localOnlyHint'),
      never: t('settings.backup.never'),
      stale: t('settings.backup.staleHint', { hours: BACKUP_MAX_AGE_HOURS }),
    }[state];
    body = (
      <Card variant="borderless" data-testid="backup-status" data-state={state}>
        <Flex vertical gap={16}>
          <Alert type={tone} showIcon title={hint} data-testid="backup-alert" />
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
                key: 'offsite',
                label: t('settings.backup.offsite'),
                children: <OffsiteText status={status} />,
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
