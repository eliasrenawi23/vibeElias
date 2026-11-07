import { Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { TKey } from '../lib/i18n';
import { EmptyState } from './EmptyState';

export interface PlaceholderPageProps {
  /** What the section will contain (a `placeholder.*` key). */
  descriptionKey: TKey;
  /** Milestone of the plan that delivers the section. */
  milestone: number;
}

/** Stand-in for a section that a later milestone builds. */
export function PlaceholderPage({ descriptionKey, milestone }: PlaceholderPageProps) {
  const { t } = useTranslation();
  return (
    <Card variant="borderless" className="rm-placeholder">
      <EmptyState
        title={t('placeholder.title')}
        description={(t as (key: TKey) => string)(descriptionKey)}
        action={
          <Tag color="gold" className="rm-milestone-tag">
            {t('placeholder.milestone', { n: milestone })}
          </Tag>
        }
      />
    </Card>
  );
}
