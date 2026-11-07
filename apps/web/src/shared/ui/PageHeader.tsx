import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Section title. The page title itself is the `<h1>` in the top bar. */
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Actions shown on the trailing side (buttons, filters). */
  extra?: ReactNode;
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <Flex className="rm-page-header" justify="space-between" align="flex-start" gap={16} wrap>
      <div className="rm-page-header-text">
        {title && (
          <Typography.Title level={2} className="rm-page-header-title">
            {title}
          </Typography.Title>
        )}
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {extra && (
        <Flex gap={8} wrap align="center">
          {extra}
        </Flex>
      )}
    </Flex>
  );
}
