import { DEFAULT_PAGE_SIZE, type SortOrder } from '@renawi/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * List state that lives in the URL (`?page&pageSize&sort&order` plus filter keys), so a filtered,
 * sorted page can be bookmarked, shared and restored with the back button.
 */

/** A change of the table's paging / sorting. */
export interface TableChange {
  page: number;
  pageSize: number;
  sort?: string;
  order?: SortOrder;
}

export interface ListParams {
  page: number;
  pageSize: number;
  sort?: string;
  order?: SortOrder;
}

export interface UseListParamsOptions {
  defaultPageSize?: number;
  defaultSort?: string;
  defaultOrder?: SortOrder;
}

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 1 ? n : undefined;
}

/** Paging and sorting from the URL, plus a setter for `DataTable.onChange`. */
export function useListParams(options: UseListParamsOptions = {}) {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, defaultSort, defaultOrder } = options;
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ListParams>(() => {
    const rawOrder = searchParams.get('order');
    const sort = searchParams.get('sort') ?? defaultSort;
    return {
      page: positiveInt(searchParams.get('page')) ?? 1,
      pageSize: positiveInt(searchParams.get('pageSize')) ?? defaultPageSize,
      sort: sort || undefined,
      order: rawOrder === 'asc' || rawOrder === 'desc' ? rawOrder : sort ? defaultOrder : undefined,
    };
  }, [searchParams, defaultPageSize, defaultSort, defaultOrder]);

  const setTableParams = useCallback(
    (change: TableChange) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          setOrDelete(next, 'page', change.page > 1 ? String(change.page) : null);
          setOrDelete(
            next,
            'pageSize',
            change.pageSize !== defaultPageSize ? String(change.pageSize) : null,
          );
          setOrDelete(next, 'sort', change.sort ?? null);
          setOrDelete(next, 'order', change.sort ? (change.order ?? null) : null);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, defaultPageSize],
  );

  return { ...params, searchParams, setTableParams };
}

/** Set a search param, or remove it for null / ''. */
export function setOrDelete(params: URLSearchParams, key: string, value: string | null): void {
  if (value === null || value === '') params.delete(key);
  else params.set(key, value);
}

/** Comma-separated list param (`status=IN_STOCK,RESERVED`) to an array. */
export function readListParam(params: URLSearchParams, key: string): string[] {
  return (params.get(key) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
