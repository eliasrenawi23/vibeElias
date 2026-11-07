import type { CommissionMode } from '@renawi/shared';
import { useTranslation } from 'react-i18next';
import { isolateLtr } from '../../../shared/lib/bidi';
import { formatAmount, formatCount } from '../../../shared/lib/money';

export interface CommissionRuleTextProps {
  mode: CommissionMode | null | undefined;
  value: number | null | undefined;
  minNet: number | null | undefined;
}

/** "Fixed ₪3,000" / "5% of the price" / "Everything above ₪60,000" (or a dash). */
export function CommissionRuleText({ mode, value, minNet }: CommissionRuleTextProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  if (!mode) return <span className="rm-empty-value">—</span>;
  const money = (n: number | null | undefined) => isolateLtr(formatAmount(n ?? 0, lang));
  let text: string;
  if (mode === 'FIXED') text = t('deals.commission.ruleFixed', { amount: money(value) });
  else if (mode === 'PERCENT') {
    text = t('deals.commission.rulePercent', {
      pct: isolateLtr(`${formatCount(value ?? 0, lang, { maximumFractionDigits: 2 })}%`),
    });
  } else text = t('deals.commission.ruleSurplus', { amount: money(minNet) });
  return <span data-testid="commission-rule">{text}</span>;
}
