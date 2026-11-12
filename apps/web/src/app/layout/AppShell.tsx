import { Drawer, Grid, Layout } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { useUi } from '../providers/UiProvider';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';
import { useListMemoryTracker } from './useListMemoryTracker';

/**
 * Authenticated layout. From `md` up: a collapsible side navigation on the leading side (right
 * in RTL, left in LTR; AntD's direction handles the flip). Below `md`: the same navigation in a
 * drawer opened from the top bar.
 */
export function AppShell() {
  const { t } = useTranslation();
  const { direction } = useUi();
  const screens = Grid.useBreakpoint();
  // `screens` is empty until the first measurement; treat that as desktop.
  const isMobile = screens.md === false;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useListMemoryTracker();

  return (
    <Layout hasSider className="rm-shell">
      <a className="rm-skip-link" href="#main-content">
        {t('layout.skipToContent')}
      </a>
      {!isMobile && (
        <Layout.Sider
          width={248}
          collapsedWidth={72}
          collapsed={collapsed}
          trigger={null}
          className="rm-sider"
          data-testid="side-nav"
        >
          <SideNav collapsed={collapsed} />
        </Layout.Sider>
      )}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement={direction === 'rtl' ? 'right' : 'left'}
          size={272}
          closable={false}
          className="rm-nav-drawer"
          styles={{ body: { padding: 0 } }}
        >
          <SideNav onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}
      <Layout className="rm-main">
        <TopBar
          isMobile={isMobile}
          collapsed={collapsed}
          onToggleNav={() => (isMobile ? setDrawerOpen(true) : setCollapsed((c) => !c))}
        />
        <Layout.Content id="main-content" tabIndex={-1} className="rm-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
