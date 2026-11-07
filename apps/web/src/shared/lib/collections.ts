/**
 * Accept either a bare array or a wrapped list (`{ items }`) from an endpoint, so the UI does
 * not depend on whether a small sub-resource list is paginated.
 */
export function asItems<T>(value: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value?.items ?? [];
}

/** Sum of numeric amounts, rounded to agorot. */
export function sumAmounts<T>(items: readonly T[], pick: (item: T) => number | string | null | undefined): number {
  const total = items.reduce((acc, item) => acc + Number(pick(item) ?? 0), 0);
  return Math.round(total * 100) / 100;
}
