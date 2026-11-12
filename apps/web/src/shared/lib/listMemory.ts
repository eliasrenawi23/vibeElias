/**
 * Remembered list filters (per top-level section, for this browser tab).
 *
 * Each list page's query string (`?status=IN_STOCK&q=toyota`) is kept in `sessionStorage` while
 * the user works inside its section, so the breadcrumb section link and the side-navigation item
 * lead back to the same filtered list. Browser back already works through the URL. Memory is
 * dropped when the user moves to another top-level section or presses "Clear filters", so stale
 * filters never surprise. Only non-empty values are stored (the list params already drop their
 * defaults: page 1, the default page size, no sort). Storage failures are ignored.
 */

const PREFIX = 'rm.listMemory.';

/** Top-level sections whose list page (`/<section>`) remembers its filters. */
export const LIST_SECTIONS = [
  'vehicles',
  'taxi-licenses',
  'drivers',
  'leases',
  'deals',
  'fines',
  'contacts',
  'reminders',
] as const;
export type ListSection = (typeof LIST_SECTIONS)[number];

/** First path segment (`/vehicles/veh_1` -> `vehicles`; the dashboard `/` -> ''). */
export function sectionOf(pathname: string): string {
  return pathname.split('/').find(Boolean) ?? '';
}

function isListSection(section: string): section is ListSection {
  return (LIST_SECTIONS as readonly string[]).includes(section);
}

/** Is this the list page of a remembering section (`/vehicles`, `/leases/`)? */
export function isListPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 1 && isListSection(parts[0] ?? '');
}

/** The query string without empty values, keys in URL order (`''` when nothing is left). */
export function normaliseSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const kept = new URLSearchParams();
  for (const [key, value] of params) if (value.trim() !== '') kept.append(key, value);
  const qs = kept.toString();
  return qs ? `?${qs}` : '';
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remember a section's list query (an empty query forgets it). */
export function saveListSearch(section: string, search: string): void {
  if (!isListSection(section)) return;
  const value = normaliseSearch(search);
  try {
    const s = storage();
    if (!s) return;
    if (value) s.setItem(PREFIX + section, value);
    else s.removeItem(PREFIX + section);
  } catch {
    // Storage full or blocked: the filters simply are not remembered.
  }
}

/** The remembered query of a section (`?status=...`), or `''`. */
export function restoreListSearch(section: string): string {
  if (!isListSection(section)) return '';
  try {
    return normaliseSearch(storage()?.getItem(PREFIX + section) ?? '');
  } catch {
    return '';
  }
}

/** Forget one section's filters, or every section's. */
export function clearListMemory(section?: string): void {
  try {
    const s = storage();
    if (!s) return;
    if (section !== undefined) {
      s.removeItem(PREFIX + section);
      return;
    }
    for (const name of LIST_SECTIONS) s.removeItem(PREFIX + name);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Link target for a section list: `/vehicles` plus its remembered query. Paths that are not a
 * bare list path, or already carry a query, are returned unchanged.
 */
export function rememberedListPath(to: string): string {
  if (to.includes('?') || !isListPath(to)) return to;
  return `${to}${restoreListSearch(sectionOf(to))}`;
}

/**
 * Called on every location change (`ListMemoryTracker` in the app shell): leaving a section
 * forgets its filters; on a list page, the current query is remembered.
 */
export function trackListLocation(
  previousPathname: string | null,
  pathname: string,
  search: string,
): void {
  const section = sectionOf(pathname);
  if (previousPathname !== null) {
    const previous = sectionOf(previousPathname);
    if (previous !== section) clearListMemory(previous);
  }
  if (isListPath(pathname)) saveListSearch(section, search);
}
