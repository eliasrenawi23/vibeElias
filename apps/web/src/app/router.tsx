import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '../features/auth/components/RequireAuth';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ContactsPage } from '../features/contacts/pages/ContactsPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { DealsPage } from '../features/deals/pages/DealsPage';
import { DriversPage } from '../features/drivers/pages/DriversPage';
import { FinesPage } from '../features/fines/pages/FinesPage';
import { LeasesPage } from '../features/leases/pages/LeasesPage';
import { RemindersPage } from '../features/reminders/pages/RemindersPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { BusinessSettingsPage } from '../features/settings/pages/BusinessSettingsPage';
import {
  BackupSettingsPage,
  ContractSettingsPage,
  ReminderSettingsPage,
} from '../features/settings/pages/SettingsPlaceholderPages';
import { TaxiLicensesPage } from '../features/taxi-licenses/pages/TaxiLicensesPage';
import { VehiclesPage } from '../features/vehicles/pages/VehiclesPage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import { RootLayout } from './RootLayout';
import type { RouteHandle } from './routeTitle';

const handle = (titleKey: RouteHandle['titleKey']): RouteHandle => ({ titleKey });

/** Route table (see the plan's "Frontend routes"; detail/new routes arrive with each milestone). */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/login', element: <LoginPage />, handle: handle('auth.login') },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <DashboardPage />, handle: handle('nav.dashboard') },
          { path: 'vehicles', element: <VehiclesPage />, handle: handle('nav.vehicles') },
          {
            path: 'taxi-licenses',
            element: <TaxiLicensesPage />,
            handle: handle('nav.taxiLicenses'),
          },
          { path: 'drivers', element: <DriversPage />, handle: handle('nav.drivers') },
          { path: 'leases', element: <LeasesPage />, handle: handle('nav.leases') },
          { path: 'deals', element: <DealsPage />, handle: handle('nav.deals') },
          { path: 'fines', element: <FinesPage />, handle: handle('nav.fines') },
          { path: 'contacts', element: <ContactsPage />, handle: handle('nav.contacts') },
          { path: 'reminders', element: <RemindersPage />, handle: handle('nav.reminders') },
          { path: 'reports', element: <ReportsPage />, handle: handle('nav.reports') },
          {
            path: 'settings',
            handle: handle('nav.settings'),
            children: [
              { index: true, element: <Navigate to="business" replace /> },
              {
                path: 'business',
                element: <BusinessSettingsPage />,
                handle: handle('settings.nav.business'),
              },
              {
                path: 'contracts',
                element: <ContractSettingsPage />,
                handle: handle('settings.nav.contracts'),
              },
              {
                path: 'reminders',
                element: <ReminderSettingsPage />,
                handle: handle('settings.nav.reminders'),
              },
              {
                path: 'backup',
                element: <BackupSettingsPage />,
                handle: handle('settings.nav.backup'),
              },
            ],
          },
          { path: '*', element: <NotFoundPage />, handle: handle('errors.pageNotFound') },
        ],
      },
    ],
  },
];

export function createRouter() {
  return createBrowserRouter(routes);
}
