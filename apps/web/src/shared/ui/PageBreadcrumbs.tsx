import { HomeOutlined } from '@ant-design/icons';
import { Breadcrumb } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export interface BreadcrumbEntry {
  title: ReactNode;
  /** Link target; entries without one are plain text (the current page). */
  to?: string;
}

export interface PageBreadcrumbsProps {
  /** After "Home": the section list, then the record (or "New ..."). */
  items: readonly BreadcrumbEntry[];
}

/**
 * Home → section list → record. Replaces the "back to the list" links of detail and `/new`
 * pages. The section link is a plain path for now; remembered list filters come later.
 */
export function PageBreadcrumbs({ items }: PageBreadcrumbsProps) {
  const { t } = useTranslation();
  const entries: BreadcrumbEntry[] = [
    {
      title: (
        <span className="rm-breadcrumb-home">
          <HomeOutlined aria-hidden />
          <span className="rm-visually-hidden">{t('breadcrumbs.home')}</span>
        </span>
      ),
      to: '/',
    },
    ...items,
  ];
  return (
    <Breadcrumb
      aria-label={t('breadcrumbs.label')}
      className="rm-breadcrumbs"
      data-testid="breadcrumbs"
      items={entries.map((entry, i) => {
        const last = i === entries.length - 1;
        return {
          key: String(i),
          title: entry.to ? (
            <Link to={entry.to}>{entry.title}</Link>
          ) : (
            <span className="rm-breadcrumb-current" aria-current={last ? 'page' : undefined}>
              {entry.title}
            </span>
          ),
        };
      })}
    />
  );
}
