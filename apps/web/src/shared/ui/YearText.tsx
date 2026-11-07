import { Ltr } from '../lib/bidi';

/** A (manufacture) year: Latin digits, no thousands separator, isolated left-to-right. */
export function YearText({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="rm-empty-value">—</span>;
  return <Ltr>{String(value)}</Ltr>;
}
