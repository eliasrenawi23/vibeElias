import { Card, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';

export interface DetailSkeletonProps {
  /** Paragraph lines (8 for a page, fewer inside a tab). */
  rows?: number;
}

/** The one loading placeholder of detail pages and their tabs. */
export function DetailSkeleton({ rows = 8 }: DetailSkeletonProps) {
  const { t } = useTranslation();
  return (
    <Card
      variant="borderless"
      className="rm-detail-skeleton"
      data-testid="detail-skeleton"
      aria-busy="true"
      aria-label={t('common.loading')}
    >
      <Skeleton active paragraph={{ rows }} />
    </Card>
  );
}
