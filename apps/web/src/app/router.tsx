import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { RequireAuth } from '../features/auth/components/RequireAuth';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ContactDetailPage } from '../features/contacts/pages/ContactDetailPage';
import { ContactsPage } from '../features/contacts/pages/ContactsPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { DealDetailPage } from '../features/deals/pages/DealDetailPage';
import { DealNewPage } from '../features/deals/pages/DealNewPage';
import { DealsPage } from '../features/deals/pages/DealsPage';
import { DriverDetailPage } from '../features/drivers/pages/DriverDetailPage';
import { DriverNewPage } from '../features/drivers/pages/DriverNewPage';
import { DriversPage } from '../features/drivers/pages/DriversPage';
import { FinesPage } from '../features/fines/pages/FinesPage';
import { LeaseDetailPage } from '../features/leases/pages/LeaseDetailPage';
import { LeaseNewPage } from '../features/leases/pages/LeaseNewPage';
import { LeasesPage } from '../features/leases/pages/LeasesPage';
import { RemindersPage } from '../features/reminders/pages/RemindersPage';
import { ReportPage } from '../features/reports/pages/ReportPage';
import { ReportsPage } from '../features/reports/pages/ReportsPage';
import { BusinessSettingsPage } from '../features/settings/pages/BusinessSettingsPage';
import { BackupSettingsPage } from '../features/settings/pages/BackupSettingsPage';
import { ContractSettingsPage } from '../features/settings/pages/ContractSettingsPage';
import { ReminderSettingsPage } from '../features/settings/pages/ReminderSettingsPage';
import { TaxiLicenseDetailPage } from '../features/taxi-licenses/pages/TaxiLicenseDetailPage';
import { TaxiLicenseNewPage } from '../features/taxi-licenses/pages/TaxiLicenseNewPage';
import { TaxiLicensesPage } from '../features/taxi-licenses/pages/TaxiLicensesPage';
import { VehicleDetailPage } from '../features/vehicles/pages/VehicleDetailPage';
import { VehicleNewPage } from '../features/vehicles/pages/VehicleNewPage';
import { VehiclesPage } from '../features/vehicles/pages/VehiclesPage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';
import { RouteErrorPage } from './pages/RouteErrorPage';
import { RootLayout } from './RootLayout';
import type { RouteHandle } from './routeTitle';

const handle = (titleKey: RouteHandle['titleKey']): RouteHandle => ({ titleKey });

/** Route table (see the plan's "Frontend routes"; the remaining detail routes arrive with their milestones). */
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
            path: 'vehicles/new',
            element: <VehicleNewPage />,
            handle: handle('vehicles.newTitle'),
          },
          {
            path: 'vehicles/:id',
            element: <VehicleDetailPage />,
            handle: handle('vehicles.detailTitle'),
          },
          {
            path: 'taxi-licenses',
            element: <TaxiLicensesPage />,
            handle: handle('nav.taxiLicenses'),
          },
          {
            path: 'taxi-licenses/new',
            element: <TaxiLicenseNewPage />,
            handle: handle('taxiLicenses.newTitle'),
          },
          {
            path: 'taxi-licenses/:id',
            element: <TaxiLicenseDetailPage />,
            handle: handle('taxiLicenses.detailTitle'),
          },
          { path: 'drivers', element: <DriversPage />, handle: handle('nav.drivers') },
          { path: 'drivers/new', element: <DriverNewPage />, handle: handle('drivers.newTitle') },
          {
            path: 'drivers/:id',
            element: <DriverDetailPage />,
            handle: handle('drivers.detailTitle'),
          },
          { path: 'leases', element: <LeasesPage />, handle: handle('nav.leases') },
          { path: 'leases/new', element: <LeaseNewPage />, handle: handle('leases.newTitle') },
          {
            path: 'leases/:id',
            element: <LeaseDetailPage />,
            handle: handle('leases.detailTitle'),
          },
          { path: 'deals', element: <DealsPage />, handle: handle('nav.deals') },
          { path: 'deals/new', element: <DealNewPage />, handle: handle('deals.newTitle') },
          {
            path: 'deals/:id',
            element: <DealDetailPage />,
            handle: handle('deals.detailTitle'),
          },
          { path: 'fines', element: <FinesPage />, handle: handle('nav.fines') },
          { path: 'contacts', element: <ContactsPage />, handle: handle('nav.contacts') },
          {
            path: 'contacts/new',
            element: <ContactDetailPage />,
            handle: handle('contacts.newTitle'),
          },
          {
            path: 'contacts/:id',
            element: <ContactDetailPage />,
            handle: handle('contacts.detailTitle'),
          },
          { path: 'reminders', element: <RemindersPage />, handle: handle('nav.reminders') },
          { path: 'reports', element: <ReportsPage />, handle: handle('nav.reports') },
          { path: 'reports/:name', element: <ReportPage />, handle: handle('nav.reports') },
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
