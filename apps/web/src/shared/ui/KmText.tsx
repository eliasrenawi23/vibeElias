import { useTranslation } from 'react-i18next';
import { Ltr } from '../lib/bidi';
import { formatCount } from '../lib/money';

/**
 * Odometer reading: Latin digits isolated left-to-right, the unit in the UI language next to it
 * (so it reads `123,456 ק״מ` in Hebrew and `123,456 km` in English).
 */
export function KmText({ value }: { value: number | null | undefined }) {
  const { t, i18n } = useTranslation();
  if (value === null || value === undefined) return <span className="rm-empty-value">—</span>;
  return (
    <span className="rm-km">
      <Ltr>{formatCount(value, i18n.resolvedLanguage)}</Ltr> {t('units.km')}
    </span>
  );
}
