import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, Typography, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AutoDir, Ltr } from '../../shared/lib/bidi';
import { useAuth } from '../providers/AuthProvider';
import { useUi } from '../providers/UiProvider';

/**
 * Avatar menu: who is signed in, the account page (change password), and log out. The theme has
 * one switch, `ThemeToggle` in the top bar.
 */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { direction } = useUi();
  if (!user) return null;

  const items: MenuProps['items'] = [
    {
      key: 'who',
      disabled: true,
      className: 'rm-user-menu-who',
      label: (
        <div>
          <Typography.Text type="secondary">{t('layout.signedInAs')}</Typography.Text>
          <div>
            <AutoDir>{user.name}</AutoDir>
          </div>
          <Typography.Text type="secondary">
            <Ltr tabular={false}>{user.email}</Ltr>
          </Typography.Text>
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'account', icon: <KeyOutlined />, label: t('settings.nav.account') },
    { key: 'logout', icon: <LogoutOutlined className="rm-flip-rtl" />, label: t('auth.logout') },
  ];

  const onClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'account') {
      navigate('/settings/account');
      return;
    }
    if (key === 'logout') {
      await logout();
      navigate('/login', { replace: true });
    }
  };

  return (
    <Dropdown
      trigger={['click']}
      menu={{ items, onClick }}
      // Align with the trailing edge of the top bar (explicit placements are not mirrored).
      placement={direction === 'rtl' ? 'bottomLeft' : 'bottomRight'}
    >
      <Button type="text" aria-label={t('layout.userMenu')} className="rm-user-menu-trigger">
        <Avatar size="small" icon={<UserOutlined />} />
        {!compact && <AutoDir className="rm-user-menu-name">{user.name}</AutoDir>}
      </Button>
    </Dropdown>
  );
}
