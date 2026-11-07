import { useTranslation } from 'react-i18next';
import { Ltr } from '../lib/bidi';
import { formatIsoDate } from '../lib/dates';

/** A calendar date (`YYYY-MM-DD`) in the UI language's order with Latin digits. */
export function DateText({ value }: { value: string | null | undefined }) {
  const { i18n } = useTranslation();
  if (!value) return <span className="rm-empty-value">—</span>;
  return (
    <time dateTime={value}>
      <Ltr>{formatIsoDate(value, i18n.resolvedLanguage)}</Ltr>
    </time>
  );
}
