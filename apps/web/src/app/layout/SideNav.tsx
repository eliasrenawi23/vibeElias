import { Menu, type MenuProps } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import type { TKey } from '../../shared/lib/i18n';
import { BrandLogo } from '../../shared/ui/BrandLogo';
import { NAV_ITEMS, openNavKeys, selectedNavKey, type NavItem } from './navItems';

export interface SideNavProps {
  /** Icon-only rail (desktop sider collapsed). */
  collapsed?: boolean;
  /** Called after a navigation (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** Brand chrome navigation: logo + menu. Placed on the leading side (right in RTL) by AppShell. */
export function SideNav({ collapsed = false, onNavigate }: SideNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [openKeys, setOpenKeys] = useState<string[]>(() => openNavKeys(pathname));
  const label = t as (key: TKey) => string;

  const toItem = (item: NavItem): NonNullable<MenuProps['items']>[number] => {
    const Icon = item.icon;
    return {
      key: item.path,
      icon: Icon ? <Icon /> : undefined,
      label: label(item.labelKey),
      children: item.children?.map(toItem),
    };
  };

  return (
    <nav className="rm-sidenav" aria-label={t('layout.mainNav')}>
      <Link to="/" className="rm-sidenav-logo" onClick={onNavigate}>
        <BrandLogo
          variant={collapsed ? 'icon' : 'horizontal'}
          onDark
          height={collapsed ? 30 : 34}
        />
      </Link>
      <Menu
        theme="dark"
        mode="inline"
        items={NAV_ITEMS.map(toItem)}
        selectedKeys={[selectedNavKey(pathname)]}
        openKeys={collapsed ? undefined : openKeys}
        onOpenChange={setOpenKeys}
        onClick={({ key }) => {
          navigate(key);
          onNavigate?.();
        }}
        className="rm-sidenav-menu"
      />
    </nav>
  );
}
