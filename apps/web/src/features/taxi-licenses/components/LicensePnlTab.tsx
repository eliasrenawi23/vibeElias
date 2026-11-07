import { sumMoney } from '@renawi/shared';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Flex, Row, Skeleton, Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { ProfitText } from '../../../shared/ui/ProfitText';
import { StatCard } from '../../../shared/ui/StatCard';
import { YearText } from '../../../shared/ui/YearText';
import { fetchTaxiLicensePnl } from '../api';
import { taxiLicenseKeys } from '../queryKeys';
import type { TaxiLicensePnl } from '../types';

type YearRow = TaxiLicensePnl['byYear'][number];

/** `?tab=pnl` of the licence file: purchase price, income by year and the net result. */
export function LicensePnlTab({ licenseId }: { licenseId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: taxiLicenseKeys.pnl(licenseId),
    queryFn: ({ signal }) => fetchTaxiLicensePnl(licenseId, signal),
  });
  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  const pnl = query.data;
  const years = [...pnl.byYear].sort((a, b) => b.year - a.year);

  return (
    <Flex vertical gap={16} data-testid="license-pnl">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <StatCard
            title={t('taxiLicenses.pnl.acquisitionPrice')}
            data-testid="license-pnl-acquisition"
          >
            <Money amount={pnl.acquisitionPrice} />
          </StatCard>
        </Col>
        <Col xs={12} md={6}>
          <StatCard title={t('taxiLicenses.pnl.totalIncome')} data-testid="license-pnl-income">
            <Money amount={pnl.totalIncome} />
          </StatCard>
        </Col>
        {pnl.salePrice !== null && pnl.salePrice !== undefined && (
          <Col xs={12} md={6}>
            <StatCard title={t('taxiLicenses.pnl.salePrice')} data-testid="license-pnl-sale">
              <Money amount={pnl.salePrice} />
            </StatCard>
          </Col>
        )}
        <Col xs={12} md={6}>
          <StatCard
            title={t('taxiLicenses.pnl.net')}
            data-testid="license-pnl-net"
            extra={
              <Typography.Text type="secondary" className="rm-stat-hint">
                {t('taxiLicenses.pnl.netHint')}
              </Typography.Text>
            }
          >
            <ProfitText amount={pnl.net} />
          </StatCard>
        </Col>
      </Row>
      <Card variant="borderless" title={t('taxiLicenses.pnl.byYear')}>
        {years.length === 0 ? (
          <EmptyState compact description={t('taxiLicenses.pnl.empty')} />
        ) : (
          <Table<YearRow>
            size="small"
            rowKey={(r) => String(r.year)}
            pagination={false}
            dataSource={years}
            data-testid="license-pnl-years"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                key: 'year',
                title: t('taxiLicenses.pnl.year'),
                render: (_: unknown, r: YearRow) => <YearText value={r.year} />,
              },
              {
                key: 'rent',
                title: t('taxiLicenses.pnl.rentIncome'),
                align: 'end',
                render: (_: unknown, r: YearRow) => <Money amount={r.rentIncome} />,
              },
              {
                key: 'other',
                title: t('taxiLicenses.pnl.otherIncome'),
                align: 'end',
                render: (_: unknown, r: YearRow) => <Money amount={r.otherIncome} />,
              },
              {
                key: 'total',
                title: t('taxiLicenses.pnl.total'),
                align: 'end',
                render: (_: unknown, r: YearRow) => (
                  <Typography.Text strong>
                    <Money amount={sumMoney([r.rentIncome, r.otherIncome])} />
                  </Typography.Text>
                ),
              },
            ]}
          />
        )}
      </Card>
    </Flex>
  );
}
