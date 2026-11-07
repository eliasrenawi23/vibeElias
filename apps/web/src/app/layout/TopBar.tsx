import { MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button, Flex, Layout, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import { useRouteTitle } from '../routeTitle';
import { LangMenu } from './LangMenu';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export interface TopBarProps {
  isMobile: boolean;
  collapsed: boolean;
  onToggleNav: () => void;
}

/** Page title (the page's `<h1>`) plus language, theme and user menus. */
export function TopBar({ isMobile, collapsed, onToggleNav }: TopBarProps) {
  const { t } = useTranslation();
  const title = useRouteTitle();

  const toggleLabel = isMobile
    ? t('layout.openMenu')
    : collapsed
      ? t('layout.expandSidebar')
      : t('layout.collapseSidebar');
  const toggleIcon = isMobile ? (
    <MenuOutlined />
  ) : collapsed ? (
    <MenuUnfoldOutlined className="rm-flip-rtl" />
  ) : (
    <MenuFoldOutlined className="rm-flip-rtl" />
  );

  return (
    <Layout.Header className="rm-topbar">
      <Button type="text" icon={toggleIcon} aria-label={toggleLabel} onClick={onToggleNav} />
      {isMobile && <BrandLogo variant="icon" height={28} />}
      <Typography.Title level={1} className="rm-topbar-title" ellipsis>
        {title}
      </Typography.Title>
      <Flex gap={4} align="center" className="rm-topbar-actions">
        <LangMenu compact={isMobile} />
        <ThemeToggle />
        <UserMenu compact={isMobile} />
      </Flex>
    </Layout.Header>
  );
}
