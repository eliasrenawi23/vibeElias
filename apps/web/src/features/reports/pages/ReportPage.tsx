import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { FineStatus, INVENTORY_AGE_BUCKETS, type ReportResult } from '@renawi/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Col, Flex, Result, Row, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { ChartCard } from '../../../shared/charts/ChartCard';
import {
  ProfitChart,
  ProfitTable,
  useProfitLegend,
  type ProfitPoint,
} from '../../../shared/charts/ProfitChart';
import { AGEING_BUCKETS, AGEING_LABEL_KEYS } from '../../../shared/charts/AgeingChart';
import { isolateLtr } from '../../../shared/lib/bidi';
import { formatIsoDate } from '../../../shared/lib/dates';
import { useEnumOptions } from '../../../shared/lib/enums';
import { useDynamicT, type TKey } from '../../../shared/lib/i18n';
import { formatCount } from '../../../shared/lib/money';
import { FilterBar, type FilterDef } from '../../../shared/ui/FilterBar';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { PageBreadcrumbs } from '../../../shared/ui/PageBreadcrumbs';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StatCard } from '../../../shared/ui/StatCard';
import { fetchReport } from '../api';
import { ReportTable } from '../components/ReportTable';
import { reportDef, reportExportHref, reportQuery, type ReportDef } from '../lib/reports';
import { reportKeys } from '../queryKeys';

/** Inventory ageing bucket (`summary.buckets` key) to its label. */
const AGE_BUCKET_KEYS: Readonly<Record<(typeof INVENTORY_AGE_BUCKETS)[number], TKey>> = {
  '0-30': 'reports.ageBuckets.b0_30',
  '31-60': 'reports.ageBuckets.b31_60',
  '61-90': 'reports.ageBuckets.b61_90',
  '90+': 'reports.ageBuckets.b90_plus',
};

/** `/reports/:name`: one report with its parameter bar, export links and table. */
export function ReportPage() {
  const { t } = useTranslation();
  const { name } = useParams();
  const report = reportDef(name);
  if (!report) {
    return (
      <Flex vertical gap={16}>
        <PageBreadcrumbs items={[{ title: t('nav.reports'), to: '/reports' }]} />
        <Result status="404" title={t('reports.notFound')} />
      </Flex>
    );
  }
  return <ReportView key={report.name} report={report} />;
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

/** Profit report rows as chart points (period, profit, lease income). */
function profitPoints(result: ReportResult): ProfitPoint[] {
  return result.rows.map((row) => ({
    period: String(row.period ?? ''),
    profit: num(row.profit),
    leaseIncome: num(row.leaseIncome),
    sales: row.salesRevenue === null || row.salesRevenue === undefined ? undefined : num(row.salesRevenue),
  }));
}

function ReportView({ report }: { report: ReportDef }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const dynamicT = useDynamicT();
  const [searchParams] = useSearchParams();
  const fineStatusOptions = useEnumOptions('FineStatus', FineStatus.options);
  const profitLegend = useProfitLegend();
  const query = useMemo(() => reportQuery(report, searchParams), [report, searchParams]);
  const title = t(report.titleKey);

  const result = useQuery({
    queryKey: reportKeys.result(report.name, query),
    queryFn: ({ signal }) => fetchReport(report.name, query, signal),
    placeholderData: keepPreviousData,
  });
  const data = result.data;

  const filters: FilterDef[] = [
    report.period === 'range'
      ? {
          type: 'dateRange',
          keys: ['from', 'to'],
          label: t('reports.params.period'),
          presets: true,
        }
      : { type: 'date', key: 'asOf', label: t('reports.params.asOf') },
    ...(report.groupBy
      ? [
          {
            type: 'select' as const,
            key: 'groupBy',
            label: t('reports.params.groupBy'),
            width: 160,
            options: report.groupBy.map((g) => ({ value: g, label: dynamicT(`reports.groupBy.${g}`) })),
          },
        ]
      : []),
    ...(report.status
      ? [
          {
            type: 'select' as const,
            key: 'status',
            label: t('reports.params.status'),
            multiple: true,
            width: 220,
            options: fineStatusOptions,
          },
        ]
      : []),
  ];

  const exportLinks = (
    <Flex gap={8} wrap>
      <Button
        href={reportExportHref(report.name, query, 'csv', lang)}
        icon={<DownloadOutlined />}
        download
        data-testid="report-export-csv"
      >
        {t('reports.export.csv')}
      </Button>
      <Button
        href={reportExportHref(report.name, query, 'xlsx', lang)}
        icon={<FileExcelOutlined />}
        download
        data-testid="report-export-xlsx"
      >
        {t('reports.export.xlsx')}
      </Button>
    </Flex>
  );

  // The effective period (defaults applied by the API) under the title.
  const params = data?.params ?? {};
  const date = (v: unknown) => (typeof v === 'string' ? isolateLtr(formatIsoDate(v, lang)) : '');
  const periodText =
    report.period === 'range'
      ? params.from && params.to
        ? t('reports.periodText', { from: date(params.from), to: date(params.to) })
        : null
      : params.asOf
        ? t('reports.asOfText', { date: date(params.asOf) })
        : null;

  const totals = data?.totals ?? {};
  const buckets = (data?.summary?.buckets ?? null) as Record<string, number> | null;

  return (
    <Flex vertical gap={16} className="rm-report-page" data-testid={`report-${report.name}`}>
      <PageBreadcrumbs items={[{ title: t('nav.reports'), to: '/reports' }, { title }]} />
      <PageHeader
        title={title}
        subtitle={
          <span>
            {t(report.descriptionKey)}
            {periodText && (
              <>
                {' '}
                <span className="rm-report-period" data-testid="report-period">
                  {periodText}
                </span>
              </>
            )}
          </span>
        }
        extra={exportLinks}
      />
      {/* The parameter bar stays visible in the empty and error states. */}
      <FilterBar
        searchKey={null}
        filters={filters}
        defaults={report.groupBy?.[0] ? { groupBy: report.groupBy[0] } : undefined}
      />
      {report.name === 'trade-book' && (
        <Alert type="info" showIcon title={t('reports.tradeBookNote')} data-testid="trade-book-note" />
      )}
      {result.isError ? (
        <LoadError
          error={result.error}
          title={t('reports.loadError')}
          onRetry={() => void result.refetch()}
        />
      ) : (
        <>
          {report.name === 'receivables' && data && (
            <section aria-label={t('reports.ageingTitle')}>
              <Row gutter={[12, 12]} data-testid="receivables-ageing">
                {AGEING_BUCKETS.map((bucket) => (
                  <Col key={bucket} xs={12} sm={8} lg={4}>
                    <StatCard title={t(AGEING_LABEL_KEYS[bucket])} data-testid={`ageing-${bucket}`}>
                      <Money amount={num(totals[bucket])} decimals={false} />
                    </StatCard>
                  </Col>
                ))}
                <Col xs={12} sm={8} lg={4}>
                  <StatCard title={t('reports.columns.overdue')} data-testid="ageing-overdue">
                    <Money amount={num(totals.overdue)} decimals={false} />
                  </StatCard>
                </Col>
              </Row>
            </section>
          )}
          {report.name === 'inventory-ageing' && buckets && (
            <section aria-label={t('reports.ageBuckets.title')}>
              <Row gutter={[12, 12]} data-testid="inventory-buckets">
                {INVENTORY_AGE_BUCKETS.map((bucket) => (
                  <Col key={bucket} xs={12} md={6}>
                    <StatCard title={t(AGE_BUCKET_KEYS[bucket])} data-testid={`bucket-${bucket}`}>
                      <bdi dir="ltr">{formatCount(num(buckets[bucket]), lang)}</bdi>{' '}
                      <Typography.Text type="secondary" className="rm-small-text">
                        {t('charts.cars')}
                      </Typography.Text>
                    </StatCard>
                  </Col>
                ))}
              </Row>
            </section>
          )}
          {report.name === 'profit' && (
            <ChartCard
              title={t('dashboard.charts.profitTitle')}
              legend={profitLegend}
              loading={result.isPending}
              fetching={result.isFetching && !result.isPending}
              empty={!data?.rows.length}
              table={data && <ProfitTable data={profitPoints(data)} />}
              data-testid="report-profit-chart"
            >
              {data && <ProfitChart data={profitPoints(data)} />}
            </ChartCard>
          )}
          {data ? (
            <ReportTable result={data} label={title} loading={result.isFetching} />
          ) : (
            <ReportTable
              result={{ report: report.name, params: {}, columns: [], rows: [] }}
              label={title}
              loading
            />
          )}
          {data && (
            <Typography.Text type="secondary" className="rm-small-text" data-testid="report-row-count">
              {t('reports.rowCount', { count: data.rows.length })}
            </Typography.Text>
          )}
        </>
      )}
    </Flex>
  );
}
