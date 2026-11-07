import { Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { daysUntil, EXPIRY_COLORS, expiryState } from '../lib/expiry';
import { DateText } from './DateText';

export interface ExpiryBadgeProps {
  /** Expiry date `YYYY-MM-DD`. */
  value: string | null | undefined;
  /** Show the date inside the tag (default true). */
  showDate?: boolean;
  /** Show a tag for dates that are still valid (default false: only expired / soon). */
  showValid?: boolean;
}

/** Expiry date with a red (past) / amber (within 30 days) / green tag. */
export function ExpiryBadge({ value, showDate = true, showValid = false }: ExpiryBadgeProps) {
  const { t } = useTranslation();
  const state = expiryState(value);
  if (!value || !state) return showDate ? <DateText value={value} /> : null;
  if (state === 'valid' && !showValid) return showDate ? <DateText value={value} /> : null;
  const label =
    state === 'expired' ? t('expiry.expired') : state === 'soon' ? t('expiry.expiring') : t('expiry.valid');
  const tooltip = state === 'soon' ? t('expiry.daysLeft', { days: daysUntil(value) }) : undefined;
  return (
    <Tooltip title={tooltip}>
      <Tag color={EXPIRY_COLORS[state]} className="rm-expiry-badge" data-expiry={state}>
        {label}
        {showDate && (
          <>
            {' · '}
            <DateText value={value} />
          </>
        )}
      </Tag>
    </Tooltip>
  );
}
