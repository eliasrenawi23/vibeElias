import { useTranslation } from 'react-i18next';
import { formatPeriod } from '../lib/dates';

/**
 * A billing period (`YYYY-MM`, e.g. a rent charge's `rentPeriod`) as the month name and year in
 * the UI language: `November 2026` / `נובמבר 2026` / `نوفمبر 2026`.
 */
export function MonthText({ value }: { value: string | null | undefined }) {
  const { i18n } = useTranslation();
  if (!value) return <span className="rm-empty-value">—</span>;
  return (
    <time dateTime={value} className="rm-month">
      {formatPeriod(value, i18n.resolvedLanguage)}
    </time>
  );
}
