/** `/drivers/:id` link. */
export function driverPath(id: string): string {
  return `/drivers/${encodeURIComponent(id)}`;
}
