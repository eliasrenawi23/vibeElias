import { addDays, addPeriods, periodEnd, periodOf, periodStart, todayInBusinessTz } from '@renawi/shared';
import type { TKey } from './i18n';

/**
 * Period presets of a date-range filter (`FilterBar` `dateRange` with `presets`). Each is a
 * closed range of calendar dates computed from today in the business time zone
 * (Asia/Jerusalem), so the office and the server agree on what "this month" is.
 */
export const DATE_PRESETS = ['thisMonth', 'lastMonth', 'yearToDate', 'lastYear', 'last30Days'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** Label key of a preset. */
export function datePresetLabelKey(preset: DatePreset): TKey {
  return `filters.presets.${preset}`;
}

/**
 * `[from, to]` (`YYYY-MM-DD`) of a preset:
 * this month = the 1st to today; last month = the whole previous month; year to date = 1 January
 * to today; last year = the whole previous calendar year; last 30 days = today and the 29 days
 * before it.
 */
export function presetRange(preset: DatePreset, today: string = todayInBusinessTz()): [string, string] {
  const month = periodOf(today);
  const year = Number(today.slice(0, 4));
  switch (preset) {
    case 'thisMonth':
      return [periodStart(month), today];
    case 'lastMonth': {
      const previous = addPeriods(month, -1);
      return [periodStart(previous), periodEnd(previous)];
    }
    case 'yearToDate':
      return [`${year}-01-01`, today];
    case 'lastYear':
      return [`${year - 1}-01-01`, `${year - 1}-12-31`];
    case 'last30Days':
      return [addDays(today, -29), today];
  }
}

/**
 * The preset a range matches exactly (the highlighted one), or null for a hand-picked range or
 * an empty one. When two presets give the same dates (this month and year to date in January),
 * the first in `presets` wins.
 */
export function activePreset(
  from: string | null | undefined,
  to: string | null | undefined,
  today: string = todayInBusinessTz(),
  presets: readonly DatePreset[] = DATE_PRESETS,
): DatePreset | null {
  if (!from || !to) return null;
  return (
    presets.find((preset) => {
      const [f, t] = presetRange(preset, today);
      return f === from && t === to;
    }) ?? null
  );
}
