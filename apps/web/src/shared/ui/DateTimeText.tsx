import { useTranslation } from 'react-i18next';
import { Ltr } from '../lib/bidi';
import { formatInstant } from '../lib/dates';

/** An instant (ISO date-time) as date and time in the business time zone, Latin digits. */
export function DateTimeText({ value }: { value: string | null | undefined }) {
  const { i18n } = useTranslation();
  if (!value) return <span className="rm-empty-value">—</span>;
  return (
    <time dateTime={value}>
      <Ltr>{formatInstant(value, i18n.resolvedLanguage)}</Ltr>
    </time>
  );
}
