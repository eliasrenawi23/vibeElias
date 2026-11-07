import {
  CarOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  RiseOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Flex, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { isolateAuto } from '../../../shared/lib/bidi';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { EXPIRING_WINDOW_DAYS, fetchExpiring, fetchKpis } from '../api';
import { KpiCard } from '../components/KpiCard';
import { dashboardKeys } from '../queryKeys';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // `GET /dashboard/kpis`: stock, active leases, receivables, month profit, open deals, overdue transfers.
  const kpis = useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: ({ signal }) => fetchKpis(signal),
  });
  const expiring = useQuery({
    queryKey: dashboardKeys.expiring(EXPIRING_WINDOW_DAYS),
    queryFn: () => fetchExpiring(EXPIRING_WINDOW_DAYS),
  });
  const k = kpis.data;
  const loading = kpis.isPending;

  return (
    <Flex vertical gap={24}>
      <PageHeader
        // The name may be in another script than the UI: isolate it (FSI ... PDI).
        title={user ? t('dashboard.welcome', { name: isolateAuto(user.name) }) : undefined}
        subtitle={t('dashboard.subtitle')}
      />
      {kpis.isError ? (
        <LoadError error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <Row gutter={[16, 16]} data-testid="dashboard-kpis">
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.vehiclesInStock')}
              value={k?.vehiclesInStock ?? 0}
              icon={<CarOutlined />}
              loading={loading}
              data-testid="kpi-vehiclesInStock"
            />
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.activeLeases')}
              value={k?.activeLeases ?? 0}
              icon={<FileProtectOutlined />}
              loading={loading}
              data-testid="kpi-activeLeases"
            />
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.receivables')}
              value={k?.receivables ?? 0}
              icon={<WalletOutlined />}
              money
              loading={loading}
              data-testid="kpi-receivables"
            />
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.monthProfit')}
              value={k?.monthProfit ?? 0}
              icon={<RiseOutlined />}
              profit
              loading={loading}
              data-testid="kpi-monthProfit"
            />
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.openDeals')}
              value={k?.openDeals ?? 0}
              icon={<SwapOutlined />}
              loading={loading}
              data-testid="kpi-openDeals"
            />
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <KpiCard
              title={t('dashboard.kpis.transfersOverdue')}
              value={k?.transfersOverdue ?? 0}
              icon={<ClockCircleOutlined />}
              alertWhenPositive
              loading={loading}
              data-testid="kpi-transfersOverdue"
            />
          </Col>
        </Row>
      )}
      <Card title={t('dashboard.expiringSoon')} variant="borderless" loading={expiring.isPending}>
        {expiring.data?.length ? null : (
          <EmptyState
            compact
            description={t('dashboard.expiringEmpty', { days: EXPIRING_WINDOW_DAYS })}
          />
        )}
      </Card>
    </Flex>
  );
}
