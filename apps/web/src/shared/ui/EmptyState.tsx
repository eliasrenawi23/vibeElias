import { Empty, Typography } from 'antd';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Call to action under the text (e.g. a "Create" button). */
  action?: ReactNode;
  /** Smaller illustration for use inside cards and lists. */
  compact?: boolean;
}

export function EmptyState({ title, description, action, compact = false }: EmptyStateProps) {
  return (
    <Empty
      className="rm-empty-state"
      image={compact ? Empty.PRESENTED_IMAGE_SIMPLE : Empty.PRESENTED_IMAGE_DEFAULT}
      description={
        <div className="rm-empty-state-text">
          {title && (
            <Typography.Title level={compact ? 5 : 4} className="rm-empty-state-title">
              {title}
            </Typography.Title>
          )}
          {description && (
            <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
          )}
        </div>
      }
    >
      {action}
    </Empty>
  );
}
