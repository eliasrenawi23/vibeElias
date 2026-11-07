import { INTL_LOCALE_TAGS, stripBidiMarks, toLocale } from '@renawi/shared';
import { formatAmount } from '../lib/money';

/**
 * Number formatting for charts and stat tiles. Every output uses Latin digits (Arabic goes
 * through `ar-IL-u-nu-latn`) and carries no bidi marks; render it inside `<bdi dir="ltr">` (or an
 * SVG `<text>` with `direction="ltr"`).
 */

const cache = new Map<string, Intl.NumberFormat>();

function nf(language: string | undefined, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const tag = INTL_LOCALE_TAGS[toLocale(language)];
  const key = `${tag}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, options);
    cache.set(key, f);
  }
  return f;
}

/** Stat tiles show amounts in full below this, compact (`1.2M ₪`, `₪245K`) from it. */
export const KPI_COMPACT_FROM = 100_000;

/** A stat-tile amount: whole shekels, auto-compact from {@link KPI_COMPACT_FROM}. */
export function formatKpiAmount(value: number, language: string | undefined): string {
  if (Math.abs(value) < KPI_COMPACT_FROM) return formatAmount(value, language, { decimals: false });
  return stripBidiMarks(
    nf(language, {
      style: 'currency',
      currency: 'ILS',
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value),
  );
}

/** A count (`1,284`). */
export function formatCountValue(value: number, language: string | undefined): string {
  return stripBidiMarks(nf(language, { maximumFractionDigits: 0 }).format(value));
}

/**
 * A value-axis tick: in full while the axis stays under 10,000 (`0 / 2,500 / 5,000`), compact on
 * an axis that reaches it (`0 / 10K / 20K`). One style per axis, decided by the axis extent.
 */
export function formatAxisTick(
  value: number,
  axisMax: number,
  language: string | undefined,
): string {
  const compact = Math.abs(axisMax) >= 10_000;
  return stripBidiMarks(
    nf(
      language,
      compact
        ? { notation: 'compact', maximumFractionDigits: 1 }
        : { maximumFractionDigits: 0 },
    ).format(value),
  );
}

/** A chart value label (bar tip, line end): whole shekels, compact from 10,000. */
export function formatChartAmount(value: number, language: string | undefined): string {
  if (Math.abs(value) < 10_000) return formatAmount(value, language, { decimals: false });
  return stripBidiMarks(
    nf(language, {
      style: 'currency',
      currency: 'ILS',
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value),
  );
}

/** A share of a whole (`46%`). */
export function formatShare(part: number, whole: number, language: string | undefined): string {
  if (whole <= 0) return stripBidiMarks(nf(language, { style: 'percent' }).format(0));
  return stripBidiMarks(
    nf(language, { style: 'percent', maximumFractionDigits: 0 }).format(part / whole),
  );
}

const periodCache = new Map<string, Intl.DateTimeFormat>();

/**
 * A report / chart period to a label: `2026-11` -> `Nov 26` (short) or `November 2026` (long) in
 * the UI language; `2026-Q4` -> the quarter template; `2026` stays as is.
 */
export function formatPeriodLabel(
  period: string,
  language: string | undefined,
  options: { style?: 'short' | 'long'; quarter?: (q: number, year: number) => string } = {},
): string {
  const { style = 'short', quarter } = options;
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (month) {
    const tag = INTL_LOCALE_TAGS[toLocale(language)];
    const key = `${tag}|${style}`;
    let f = periodCache.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat(
        tag,
        style === 'short'
          ? { timeZone: 'UTC', month: 'short', year: '2-digit' }
          : { timeZone: 'UTC', month: 'long', year: 'numeric' },
      );
      periodCache.set(key, f);
    }
    return stripBidiMarks(f.format(new Date(Date.UTC(Number(month[1]), Number(month[2]) - 1, 1))));
  }
  const q = /^(\d{4})-?Q([1-4])$/i.exec(period);
  if (q && quarter) return quarter(Number(q[2]), Number(q[1]));
  return period;
}
