import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface StatCardProps {
  title: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
  'data-testid'?: string;
}

/** A small summary figure (balance, deposit held, ageing bucket) in a borderless card. */
export function StatCard({ title, children, extra, 'data-testid': testId }: StatCardProps) {
  return (
    <Card variant="borderless" size="small" className="rm-stat-card" data-testid={testId}>
      <Typography.Text type="secondary" className="rm-stat-title">
        {title}
      </Typography.Text>
      <div className="rm-stat-value">{children}</div>
      {extra && <div className="rm-stat-extra">{extra}</div>}
    </Card>
  );
}
