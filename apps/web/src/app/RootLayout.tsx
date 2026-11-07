import { Outlet } from 'react-router';
import { useDocumentTitle } from './routeTitle';

/** Root route: keeps `<title>` in sync with the matched route and the language. */
export function RootLayout() {
  useDocumentTitle();
  return <Outlet />;
}
