import { useQuery } from '@tanstack/react-query';
import { Card, Col, Descriptions, Flex, Row, Skeleton, Tag, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEnumLabel } from '../../../shared/lib/enums';
import { DateText } from '../../../shared/ui/DateText';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { Money } from '../../../shared/ui/Money';
import { ProfitText } from '../../../shared/ui/ProfitText';
import { fetchVehiclePnl } from '../api';
import { vehicleKeys } from '../queryKeys';
import type { CyclePnl, VehiclePnl } from '../types';

/** `?tab=pnl` of the vehicle file: one card per inventory cycle and the totals. */
export function VehiclePnlTab({ vehicleId }: { vehicleId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: vehicleKeys.pnl(vehicleId),
    queryFn: ({ signal }) => fetchVehiclePnl(vehicleId, signal),
  });
  if (query.isPending) {
    return (
      <Card variant="borderless">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }
  if (query.isError) return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  return <VehiclePnlView pnl={query.data} emptyText={t('vehicles.pnl.empty')} />;
}

/** The P&L cards (newest cycle first) and the totals card. */
export function VehiclePnlView({ pnl, emptyText }: { pnl: VehiclePnl; emptyText: ReactNode }) {
  const { t } = useTranslation();
  if (pnl.cycles.length === 0) return <EmptyState compact description={emptyText} />;
  const cycles = [...pnl.cycles].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return (
    <Flex vertical gap={16} data-testid="vehicle-pnl">
      <Card variant="borderless" title={t('vehicles.pnl.totals')} data-testid="pnl-totals">
        <Flex gap={32} wrap>
          <Figure label={t('vehicles.pnl.revenue')}>
            <Money amount={pnl.totals.revenue} />
          </Figure>
          <Figure label={t('vehicles.pnl.costs')}>
            <Money amount={pnl.totals.costs} />
          </Figure>
          <Figure label={t('vehicles.pnl.profit')}>
            <ProfitText amount={pnl.totals.profit} data-testid="pnl-total-profit" />
          </Figure>
        </Flex>
      </Card>
      <Row gutter={[16, 16]}>
        {cycles.map((c) => (
          <Col key={c.id} xs={24} lg={12}>
            <CyclePnlCard cycle={c} />
          </Col>
        ))}
      </Row>
    </Flex>
  );
}

function Figure({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="rm-pnl-figure">
      <Typography.Text type="secondary" className="rm-stat-title">
        {label}
      </Typography.Text>
      <div className="rm-stat-value">{children}</div>
    </div>
  );
}

/** Estimated profit of an open cycle at the listing price, if the API sent one. */
function unrealisedAmount(cycle: CyclePnl): number | null {
  return typeof cycle.unrealised === 'number' ? cycle.unrealised : null;
}

/** One inventory cycle: kind, dates, revenue and cost breakdowns, profit (or its estimate). */
export function CyclePnlCard({ cycle }: { cycle: CyclePnl }) {
  const { t } = useTranslation();
  const enumLabel = useEnumLabel();
  const consigned = cycle.kind === 'CONSIGNED';
  const estimate = unrealisedAmount(cycle);
  const unrealised = cycle.open || cycle.unrealised === true || estimate !== null;
  const line = (key: string, label: string, amount: number | null | undefined, hideZero = true) =>
    hideZero && !amount ? [] : [{ key, label, children: <Money amount={amount ?? 0} /> }];

  return (
    <Card
      variant="borderless"
      className="rm-pnl-card"
      data-testid="pnl-cycle"
      data-cycle={cycle.id}
      data-open={cycle.open}
      title={
        <Flex gap={8} align="center" wrap>
          <Tag color={consigned ? 'purple' : 'blue'}>{enumLabel('CycleKind', cycle.kind)}</Tag>
          <span className="rm-nowrap">
            <DateText value={cycle.startedAt} /> –{' '}
            {cycle.endedAt ? <DateText value={cycle.endedAt} /> : t('vehicles.pnl.open')}
          </span>
          {unrealised && (
            <Tooltip title={t('vehicles.pnl.unrealisedHint')}>
              <Tag color="gold" data-testid="pnl-unrealised">
                {t('vehicles.pnl.unrealised')}
              </Tag>
            </Tooltip>
          )}
        </Flex>
      }
      extra={<ProfitText amount={estimate ?? cycle.profit} data-testid="pnl-cycle-profit" />}
    >
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Typography.Text strong>{t('vehicles.pnl.revenue')}</Typography.Text>
          <Descriptions
            size="small"
            column={1}
            data-testid="pnl-revenue"
            items={[
              ...line('sale', t('vehicles.pnl.sale'), cycle.revenue.sale, consigned),
              ...line(
                'commission',
                t('vehicles.pnl.commission'),
                cycle.revenue.commission,
                !consigned,
              ),
              ...line('leaseIncome', t('vehicles.pnl.leaseIncome'), cycle.revenue.leaseIncome),
              ...line('rebilled', t('vehicles.pnl.rebilled'), cycle.revenue.rebilled),
              {
                key: 'total',
                label: <Typography.Text strong>{t('vehicles.pnl.total')}</Typography.Text>,
                children: (
                  <Typography.Text strong>
                    <Money amount={cycle.revenue.total} />
                  </Typography.Text>
                ),
              },
            ]}
          />
        </Col>
        <Col xs={24} sm={12}>
          <Typography.Text strong>{t('vehicles.pnl.costs')}</Typography.Text>
          <Descriptions
            size="small"
            column={1}
            data-testid="pnl-costs"
            items={[
              ...line('purchase', t('vehicles.pnl.purchase'), cycle.costs.purchase, consigned),
              ...line('expenses', t('vehicles.pnl.expenses'), cycle.costs.expenses, false),
              ...line('vatOnMargin', t('vehicles.pnl.vatOnMargin'), cycle.costs.vatOnMargin),
              {
                key: 'total',
                label: <Typography.Text strong>{t('vehicles.pnl.total')}</Typography.Text>,
                children: (
                  <Typography.Text strong>
                    <Money amount={cycle.costs.total} />
                  </Typography.Text>
                ),
              },
            ]}
          />
        </Col>
      </Row>
      <Flex justify="space-between" align="center" className="rm-pnl-profit-row">
        <Typography.Text strong>
          {unrealised ? t('vehicles.pnl.estimatedProfit') : t('vehicles.pnl.profit')}
        </Typography.Text>
        <ProfitText amount={estimate ?? cycle.profit} />
      </Flex>
      {unrealised && cycle.listingPrice ? (
        <Typography.Text type="secondary" className="rm-small-text">
          {t('vehicles.pnl.atListingPrice')} <Money amount={cycle.listingPrice} />
        </Typography.Text>
      ) : null}
    </Card>
  );
}
