import { useQueryClient } from '@tanstack/react-query';
import { App, Card, Col, Descriptions, Flex, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { AutoDir, Ltr } from '../../../shared/lib/bidi';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DESCRIPTION_COLUMNS_SINGLE } from '../../../shared/ui/descriptionColumns';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { ChangePasswordForm } from '../forms/ChangePasswordForm';
import { authKeys } from '../queryKeys';

/** `/settings/account` (user menu → Account): who is signed in, and changing the password. */
export function AccountPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const enumLabel = useEnumLabel();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Flex vertical gap={16} className="rm-settings-page">
      <PageHeader subtitle={t('settings.account.description')} />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card variant="borderless" title={t('auth.profile')} data-testid="account-profile">
            <Descriptions
              column={DESCRIPTION_COLUMNS_SINGLE}
              items={[
                {
                  key: 'name',
                  label: t('settings.account.name'),
                  children: <AutoDir>{user.name}</AutoDir>,
                },
                {
                  key: 'email',
                  label: t('auth.email'),
                  children: <Ltr tabular={false}>{user.email}</Ltr>,
                },
                {
                  key: 'role',
                  label: t('settings.account.role'),
                  children: enumLabel('Role', user.role),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card variant="borderless" title={t('auth.changePassword')}>
            <ChangePasswordForm
              onChanged={(updated) => {
                queryClient.setQueryData(authKeys.me(), updated);
                void message.success(t('auth.passwordChangedOthers'));
              }}
            />
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
