import {
  CheckOutlined,
  DesktopOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Theme } from '@renawi/shared';
import { Avatar, Button, Dropdown, Typography, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AutoDir, Ltr } from '../../shared/lib/bidi';
import { useAuth, usePreferences } from '../providers/AuthProvider';
import { useUi } from '../providers/UiProvider';

const THEME_ICONS = { light: <SunOutlined />, dark: <MoonOutlined />, system: <DesktopOutlined /> };

/** Avatar menu: who is signed in, theme preference (incl. "follow system") and log out. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { themePreference, direction } = useUi();
  const setPreferences = usePreferences();
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
    {
      key: 'theme',
      label: t('theme.label'),
      icon: THEME_ICONS[themePreference],
      children: Theme.options.map((option) => ({
        key: `theme:${option}`,
        icon: THEME_ICONS[option],
        label: t(`theme.${option}`),
        extra: option === themePreference ? <CheckOutlined /> : undefined,
      })),
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined className="rm-flip-rtl" />, label: t('auth.logout') },
  ];

  const onClick: MenuProps['onClick'] = async ({ key }) => {
    if (key.startsWith('theme:')) {
      setPreferences({ theme: key.slice('theme:'.length) as Theme });
    } else if (key === 'logout') {
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
