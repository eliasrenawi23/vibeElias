import { useTranslation } from 'react-i18next';
import { formatPeriodLabel } from './format';

/** Period label in the UI language (`Nov 26` / `November 2026`, `Q4 2026`, `2026`), Latin digits. */
export function usePeriodLabel(): (period: string, style?: 'short' | 'long') => string {
  const { t, i18n } = useTranslation();
  return (period, style = 'short') =>
    formatPeriodLabel(period, i18n.resolvedLanguage, {
      style,
      quarter: (q, year) => t('charts.quarter', { q, year }),
    });
}
