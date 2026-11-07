import type { DecimalValue } from '@renawi/shared';
import { Money } from './Money';

/** Sign of a profit: `profit` (> 0), `zero` or `loss` (< 0). */
export type ProfitState = 'profit' | 'zero' | 'loss';

/** Classify a profit (amounts within half an agora of zero count as zero). */
export function profitState(amount: DecimalValue | null | undefined): ProfitState {
  const n = Number(amount?.toString() ?? 0);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return 'zero';
  return n > 0 ? 'profit' : 'loss';
}

/** CSS classes per profit state (green / grey / red). */
export const PROFIT_CLASSES: Readonly<Record<ProfitState, string>> = {
  profit: 'rm-profit rm-profit-positive',
  zero: 'rm-profit rm-profit-zero',
  loss: 'rm-profit rm-profit-negative',
};

export interface ProfitTextProps {
  amount: DecimalValue | null | undefined;
  decimals?: boolean;
  'data-testid'?: string;
}

/**
 * A profit or loss: positive green, zero grey, negative red (the opposite of a driver balance,
 * where a positive amount is money owed to us). The amount keeps its sign.
 */
export function ProfitText({ amount, decimals = true, 'data-testid': testId }: ProfitTextProps) {
  const state = profitState(amount);
  return (
    <span
      className={PROFIT_CLASSES[state]}
      data-profit={state}
      data-testid={testId ?? 'profit-text'}
    >
      <Money amount={amount ?? 0} decimals={decimals} />
    </span>
  );
}
