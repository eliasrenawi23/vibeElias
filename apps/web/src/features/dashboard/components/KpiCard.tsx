import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';
import { Money } from '../../../shared/ui/Money';
import { ProfitText } from '../../../shared/ui/ProfitText';

export interface KpiCardProps {
  title: ReactNode;
  value: number;
  icon: ReactNode;
  /** Render the value as an ILS amount. */
  money?: boolean;
  /** ILS amount coloured as a profit (green) or loss (red). */
  profit?: boolean;
  /** Highlight a count that needs attention (e.g. overdue transfers) when above zero. */
  alertWhenPositive?: boolean;
  loading?: boolean;
  'data-testid'?: string;
}

export function KpiCard({
  title,
  value,
  icon,
  money = false,
  profit = false,
  alertWhenPositive = false,
  loading,
  'data-testid': testId,
}: KpiCardProps) {
  const formatter = profit
    ? () => <ProfitText amount={value} decimals={false} data-testid="kpi-profit" />
    : money
      ? () => <Money amount={value} decimals={false} />
      : undefined;
  return (
    <Card
      variant="borderless"
      className={['rm-kpi-card', alertWhenPositive && value > 0 ? 'rm-kpi-alert' : undefined]
        .filter(Boolean)
        .join(' ')}
      data-testid={testId}
    >
      <div className="rm-kpi-icon" aria-hidden>
        {icon}
      </div>
      <Statistic
        title={title}
        value={value}
        loading={loading}
        className="rm-tabular"
        formatter={formatter}
      />
    </Card>
  );
}
