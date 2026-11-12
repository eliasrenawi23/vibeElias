import {
  AlertOutlined,
  BookOutlined,
  CarOutlined,
  DollarOutlined,
  RightOutlined,
  RiseOutlined,
  ToolOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { ReportName } from '@renawi/shared';
import { Card, Flex, Typography } from 'antd';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { REPORTS } from '../lib/reports';

export const REPORT_ICONS: Readonly<Record<ReportName, ComponentType>> = {
  profit: RiseOutlined,
  'inventory-ageing': CarOutlined,
  receivables: WalletOutlined,
  expenses: ToolOutlined,
  'lease-income': DollarOutlined,
  'trade-book': BookOutlined,
  fines: AlertOutlined,
};

/** `/reports`: one card per report with what it answers. */
export function ReportsPage() {
  const { t } = useTranslation();
  return (
    <Flex vertical gap={16}>
      <PageHeader subtitle={t('reports.indexSubtitle')} />
      <ul className="rm-report-grid" data-testid="report-index">
        {REPORTS.map((report) => {
          const Icon = REPORT_ICONS[report.name];
          return (
            <li key={report.name}>
              <Link
                to={`/reports/${report.name}`}
                className="rm-report-card-link"
                data-testid={`report-card-${report.name}`}
              >
                <Card variant="borderless" className="rm-report-card" hoverable>
                  <Flex gap={12} align="flex-start">
                    <span className="rm-fact-icon rm-report-card-icon" aria-hidden>
                      <Icon />
                    </span>
                    <Flex vertical gap={4} className="rm-grow">
                      <Typography.Title level={3} className="rm-report-card-title">
                        {t(report.titleKey)}
                      </Typography.Title>
                      <Typography.Text type="secondary">{t(report.descriptionKey)}</Typography.Text>
                      <span className="rm-report-card-open">
                        {t('reports.open')} <RightOutlined className="rm-flip-rtl" aria-hidden />
                      </span>
                    </Flex>
                  </Flex>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </Flex>
  );
}
