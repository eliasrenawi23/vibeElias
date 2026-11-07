import type { DecimalValue } from '@renawi/shared';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { Money } from './Money';

/** Sign of a driver balance: `owes` (> 0, the driver owes us), `zero`, `credit` (< 0). */
export type BalanceState = 'owes' | 'zero' | 'credit';

/** Classify a balance (amounts within half an agora of zero count as zero). */
export function balanceState(amount: DecimalValue | null | undefined): BalanceState {
  const n = Number(amount?.toString() ?? 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return 'zero';
  return n > 0 ? 'owes' : 'credit';
}

/** CSS classes per balance state (red / grey / green). */
export const BALANCE_CLASSES: Readonly<Record<BalanceState, string>> = {
  owes: 'rm-balance rm-balance-owes',
  zero: 'rm-balance rm-balance-zero',
  credit: 'rm-balance rm-balance-credit',
};

export interface BalanceTextProps {
  amount: DecimalValue | null | undefined;
  decimals?: boolean;
  /** Explain the colour in a tooltip ("owes us" / "in credit"). Default true. */
  tooltip?: boolean;
}

/**
 * A driver balance: positive = the driver owes us (red), zero (grey), negative = credit in the
 * driver's favour (green). The amount keeps its sign and is isolated left-to-right.
 */
export function BalanceText({ amount, decimals = true, tooltip = true }: BalanceTextProps) {
  const { t } = useTranslation();
  const state = balanceState(amount);
  const node = (
    <span className={BALANCE_CLASSES[state]} data-balance={state} data-testid="balance-text">
      <Money amount={amount ?? 0} decimals={decimals} />
    </span>
  );
  if (!tooltip || state === 'zero') return node;
  return (
    <Tooltip title={state === 'owes' ? t('ledger.owesUs') : t('ledger.inCredit')}>{node}</Tooltip>
  );
}
