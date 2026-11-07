import { CarOutlined, FileProtectOutlined, RiseOutlined, WalletOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Flex, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../app/providers/AuthProvider';
import { isolateAuto } from '../../../shared/lib/bidi';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { countVehicles } from '../../vehicles/api';
import { vehicleKeys } from '../../vehicles/queryKeys';
import { EXPIRING_WINDOW_DAYS, fetchExpiring, fetchKpis, LIVE_DASHBOARD_MILESTONE } from '../api';
import { KpiCard } from '../components/KpiCard';
import { dashboardKeys } from '../queryKeys';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const kpis = useQuery({ queryKey: dashboardKeys.kpis(), queryFn: fetchKpis });
  // Live since milestone 2: `GET /vehicles?status=IN_STOCK&pageSize=1` -> `total`.
  const inStock = useQuery({
    queryKey: vehicleKeys.count('IN_STOCK'),
    queryFn: ({ signal }) => countVehicles('IN_STOCK', signal),
  });
  const expiring = useQuery({
    queryKey: dashboardKeys.expiring(EXPIRING_WINDOW_DAYS),
    queryFn: () => fetchExpiring(EXPIRING_WINDOW_DAYS),
  });
  const k = kpis.data;

  return (
    <Flex vertical gap={24}>
      <PageHeader
        // The name may be in another script than the UI: isolate it (FSI ... PDI).
        title={user ? t('dashboard.welcome', { name: isolateAuto(user.name) }) : undefined}
        subtitle={t('dashboard.subtitle')}
      />
      <Alert
        type="info"
        showIcon
        title={t('dashboard.sampleData', { n: LIVE_DASHBOARD_MILESTONE })}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title={t('dashboard.kpis.vehiclesInStock')}
            value={inStock.data ?? 0}
            icon={<CarOutlined />}
            loading={inStock.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title={t('dashboard.kpis.activeLeases')}
            value={k?.activeLeases ?? 0}
            icon={<FileProtectOutlined />}
            loading={kpis.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title={t('dashboard.kpis.receivables')}
            value={k?.receivables ?? 0}
            icon={<WalletOutlined />}
            money
            loading={kpis.isPending}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title={t('dashboard.kpis.monthProfit')}
            value={k?.monthProfit ?? 0}
            icon={<RiseOutlined />}
            money
            loading={kpis.isPending}
          />
        </Col>
      </Row>
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
