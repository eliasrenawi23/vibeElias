import type { DecimalValue } from '@renawi/shared';
import { useTranslation } from 'react-i18next';
import { Ltr } from '../lib/bidi';
import { formatAmount } from '../lib/money';

export interface MoneyProps {
  amount: DecimalValue | null | undefined;
  /** Show agorot (default true). */
  decimals?: boolean;
  /** Colour negative amounts with the error colour. */
  signColor?: boolean;
  className?: string;
}

/**
 * An ILS amount: Latin digits in every language, tabular figures, isolated in
 * `<bdi dir="ltr">` so the sign, digits and `₪` never reorder inside Hebrew/Arabic text.
 */
export function Money({ amount, decimals = true, signColor = false, className }: MoneyProps) {
  const { i18n } = useTranslation();
  if (amount === null || amount === undefined || amount === '') {
    return <span className="rm-empty-value">—</span>;
  }
  const text = formatAmount(amount, i18n.resolvedLanguage, { decimals });
  const negative = signColor && Number(amount.toString()) < 0;
  return (
    <Ltr className={[negative ? 'rm-money rm-money-negative' : 'rm-money', className].join(' ')}>
      {text}
    </Ltr>
  );
}
