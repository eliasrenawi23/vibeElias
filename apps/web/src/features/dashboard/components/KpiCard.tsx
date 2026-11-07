import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';
import { Money } from '../../../shared/ui/Money';

export interface KpiCardProps {
  title: ReactNode;
  value: number;
  icon: ReactNode;
  /** Render the value as an ILS amount. */
  money?: boolean;
  loading?: boolean;
}

export function KpiCard({ title, value, icon, money = false, loading }: KpiCardProps) {
  return (
    <Card variant="borderless" className="rm-kpi-card">
      <div className="rm-kpi-icon" aria-hidden>
        {icon}
      </div>
      <Statistic
        title={title}
        value={value}
        loading={loading}
        className="rm-tabular"
        formatter={money ? () => <Money amount={value} decimals={false} /> : undefined}
      />
    </Card>
  );
}
