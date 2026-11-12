import {
  AlertOutlined,
  BarChartOutlined,
  BellOutlined,
  CarOutlined,
  ContactsOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SwapOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';
import type { TKey } from '../../shared/lib/i18n';

export interface NavItem {
  path: string;
  labelKey: TKey;
  icon?: ComponentType;
  children?: NavItem[];
}

/** Side navigation, in the order of the plan's routes. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', labelKey: 'nav.dashboard', icon: DashboardOutlined },
  { path: '/vehicles', labelKey: 'nav.vehicles', icon: CarOutlined },
  { path: '/taxi-licenses', labelKey: 'nav.taxiLicenses', icon: SafetyCertificateOutlined },
  { path: '/drivers', labelKey: 'nav.drivers', icon: TeamOutlined },
  { path: '/leases', labelKey: 'nav.leases', icon: FileProtectOutlined },
  { path: '/deals', labelKey: 'nav.deals', icon: SwapOutlined },
  { path: '/fines', labelKey: 'nav.fines', icon: AlertOutlined },
  { path: '/contacts', labelKey: 'nav.contacts', icon: ContactsOutlined },
  { path: '/reminders', labelKey: 'nav.reminders', icon: BellOutlined },
  { path: '/reports', labelKey: 'nav.reports', icon: BarChartOutlined },
  {
    path: '/settings',
    labelKey: 'nav.settings',
    icon: SettingOutlined,
    children: [
      { path: '/settings/business', labelKey: 'settings.nav.business' },
      { path: '/settings/contracts', labelKey: 'settings.nav.contracts' },
      { path: '/settings/reminders', labelKey: 'settings.nav.reminders' },
      { path: '/settings/backup', labelKey: 'settings.nav.backup' },
      { path: '/settings/account', labelKey: 'settings.nav.account' },
    ],
  },
];

function flatten(items: readonly NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

const ALL_PATHS = flatten(NAV_ITEMS)
  .map((item) => item.path)
  .sort((a, b) => b.length - a.length);

/** Menu key to highlight for a location: the longest nav path that prefixes it. */
export function selectedNavKey(pathname: string): string {
  return (
    ALL_PATHS.find((p) =>
      p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`),
    ) ?? ''
  );
}

/** Parent menu keys to open for a location (the settings sub-menu). */
export function openNavKeys(pathname: string): string[] {
  return NAV_ITEMS.filter(
    (item) => item.children && (pathname === item.path || pathname.startsWith(`${item.path}/`)),
  ).map((item) => item.path);
}
