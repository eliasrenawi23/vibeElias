import {
  AlertOutlined,
  CalendarOutlined,
  CarOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  ReloadOutlined,
  RiseOutlined,
  SwapOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '../../../app/providers/AuthProvider';
import { AgeingChart, AgeingTable, ageingTotal } from '../../../shared/charts/AgeingChart';
import { ChartCard } from '../../../shared/charts/ChartCard';
import { formatKpiAmount } from '../../../shared/charts/format';
import {
  InventoryBar,
  InventoryTable,
  inventoryTotal,
  useInventoryLegend,
} from '../../../shared/charts/InventoryBar';
import { ProfitChart, ProfitTable, useProfitLegend } from '../../../shared/charts/ProfitChart';
import { isolateAuto, isolateLtr } from '../../../shared/lib/bidi';
import { formatClockTime } from '../../../shared/lib/dates';
import { LoadError } from '../../../shared/ui/LoadError';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { reminderKeys } from '../../reminders/queryKeys';
import { CHART_MONTHS, fetchCharts, fetchKpis } from '../api';
import { ActivityList } from '../components/ActivityList';
import { ExpiringWidget } from '../components/ExpiringWidget';
import { KpiCard, type KpiTrend } from '../components/KpiCard';
import { profitChange } from '../lib/kpis';
import { dashboardKeys } from '../queryKeys';

/**
 * `/`: KPI tiles, the expiring-soon list, charts (profit by month, receivables ageing,
 * inventory) and the recent activity, with "last updated" and a refresh button.
 */
export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const kpis = useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: ({ signal }) => fetchKpis(signal),
  });
  const charts = useQuery({
    queryKey: dashboardKeys.charts(CHART_MONTHS),
    queryFn: ({ signal }) => fetchCharts(CHART_MONTHS, signal),
  });
  const fetching =
    useIsFetching({ queryKey: dashboardKeys.all }) + useIsFetching({ queryKey: reminderKeys.feeds() });
  const profitLegend = useProfitLegend();
  const inventoryLegend = useInventoryLegend(
    charts.data?.inventory ?? { inStock: 0, reserved: 0, leased: 0, consigned: 0 },
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    void queryClient.invalidateQueries({ queryKey: reminderKeys.feeds() });
  };
  const updatedAt = Math.max(kpis.dataUpdatedAt, charts.dataUpdatedAt);

  const k = kpis.data;
  const loading = kpis.isPending;
  const change = profitChange(charts.data?.profitByMonth);
  const profitTrend: KpiTrend | null = change
    ? {
        direction: change.direction,
        tone: change.direction === 'up' ? 'success' : change.direction === 'down' ? 'error' : 'neutral',
        label:
          change.direction === 'flat'
            ? t('dashboard.trend.flat')
            : t(change.direction === 'up' ? 'dashboard.trend.up' : 'dashboard.trend.down', {
                value: isolateLtr(formatKpiAmount(change.delta, lang)),
              }),
      }
    : null;
  const overdueReceivables = k?.receivablesOverdue;

  const chartError = charts.isError ? (
    <LoadError
      error={charts.error}
      title={t('dashboard.charts.error')}
      onRetry={() => void charts.refetch()}
    />
  ) : undefined;

  return (
    <Flex vertical gap={24} className="rm-dashboard">
      <PageHeader
        // The name may be in another script than the UI: isolate it (FSI ... PDI).
        title={user ? t('dashboard.welcome', { name: isolateAuto(user.name) }) : undefined}
        subtitle={t('dashboard.subtitle')}
        extra={
          <Flex gap={8} align="center" className="rm-dashboard-updated">
            {updatedAt > 0 && (
              <Typography.Text type="secondary" data-testid="dashboard-updated">
                {t('dashboard.lastUpdated', {
                  time: isolateLtr(formatClockTime(updatedAt, lang)),
                })}
              </Typography.Text>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={refresh}
              loading={fetching > 0}
              data-testid="dashboard-refresh"
            >
              {t('actions.refresh')}
            </Button>
          </Flex>
        }
      />

      {kpis.isError ? (
        <LoadError error={kpis.error} onRetry={() => void kpis.refetch()} />
      ) : (
        <div className="rm-kpi-grid" data-testid="dashboard-kpis">
          <KpiCard
            title={t('dashboard.kpis.vehiclesInStock')}
            info={t('dashboard.kpiInfo.vehiclesInStock')}
            value={k?.vehiclesInStock}
            icon={<CarOutlined />}
            loading={loading}
            data-testid="kpi-vehiclesInStock"
          />
          <KpiCard
            title={t('dashboard.kpis.activeLeases')}
            info={t('dashboard.kpiInfo.activeLeases')}
            value={k?.activeLeases}
            icon={<FileProtectOutlined />}
            loading={loading}
            data-testid="kpi-activeLeases"
          />
          <KpiCard
            title={t('dashboard.kpis.receivables')}
            info={t('dashboard.kpiInfo.receivables')}
            value={k?.receivables}
            format="money"
            icon={<WalletOutlined />}
            sub={
              overdueReceivables === undefined
                ? undefined
                : overdueReceivables > 0
                  ? t('dashboard.kpiSub.receivablesOverdue', {
                      amount: isolateLtr(formatKpiAmount(overdueReceivables, lang)),
                    })
                  : t('dashboard.kpiSub.receivablesNoneOverdue')
            }
            subTone={overdueReceivables && overdueReceivables > 0 ? 'error' : undefined}
            loading={loading}
            data-testid="kpi-receivables"
          />
          <KpiCard
            title={t('dashboard.kpis.monthProfit')}
            info={t('dashboard.kpiInfo.monthProfit')}
            value={k?.monthProfit}
            format="profit"
            icon={<RiseOutlined />}
            trend={profitTrend}
            loading={loading}
            data-testid="kpi-monthProfit"
          />
          <KpiCard
            title={t('dashboard.kpis.openDeals')}
            info={t('dashboard.kpiInfo.openDeals')}
            value={k?.openDeals}
            icon={<SwapOutlined />}
            loading={loading}
            data-testid="kpi-openDeals"
          />
          <KpiCard
            title={t('dashboard.kpis.transfersOverdue')}
            info={t('dashboard.kpiInfo.transfersOverdue')}
            value={k?.transfersOverdue}
            icon={<ClockCircleOutlined />}
            alert
            loading={loading}
            data-testid="kpi-transfersOverdue"
          />
          <KpiCard
            title={t('dashboard.kpis.expiring')}
            info={t('dashboard.kpiInfo.expiring')}
            value={k?.expiring?.overdue}
            icon={<CalendarOutlined />}
            alert
            sub={
              k?.expiring
                ? t('dashboard.kpiSub.expiringDue', { count: k.expiring.due })
                : undefined
            }
            subTone={k?.expiring && k.expiring.due > 0 ? 'warning' : undefined}
            loading={loading}
            data-testid="kpi-expiring"
          />
          <KpiCard
            title={t('dashboard.kpis.finesOpen')}
            info={t('dashboard.kpiInfo.finesOpen')}
            value={k?.finesOpen}
            icon={<AlertOutlined />}
            loading={loading}
            data-testid="kpi-finesOpen"
          />
        </div>
      )}

      <div className="rm-dashboard-row">
        <ExpiringWidget />
        <ChartCard
          title={t('dashboard.charts.profitTitle')}
          subtitle={t('dashboard.charts.profitSubtitle')}
          legend={profitLegend}
          loading={charts.isPending}
          fetching={charts.isFetching && !charts.isPending}
          error={chartError}
          empty={!charts.data?.profitByMonth.length}
          extra={<Link to="/reports/profit">{t('dashboard.charts.viewReport')}</Link>}
          table={<ProfitTable data={charts.data?.profitByMonth ?? []} />}
          data-testid="chart-profit"
        >
          <ProfitChart data={charts.data?.profitByMonth ?? []} />
        </ChartCard>
      </div>

      <div className="rm-dashboard-row rm-dashboard-row-even">
        <ChartCard
          title={t('dashboard.charts.ageingTitle')}
          subtitle={t('dashboard.charts.ageingSubtitle')}
          loading={charts.isPending}
          fetching={charts.isFetching && !charts.isPending}
          error={chartError}
          empty={!charts.data || ageingTotal(charts.data.receivablesAgeing) === 0}
          extra={<Link to="/reports/receivables">{t('dashboard.charts.viewReport')}</Link>}
          table={charts.data && <AgeingTable ageing={charts.data.receivablesAgeing} />}
          data-testid="chart-ageing"
        >
          {charts.data && <AgeingChart ageing={charts.data.receivablesAgeing} />}
        </ChartCard>
        <ChartCard
          title={t('dashboard.charts.inventoryTitle')}
          subtitle={t('dashboard.charts.inventorySubtitle')}
          legend={inventoryLegend}
          loading={charts.isPending}
          fetching={charts.isFetching && !charts.isPending}
          error={chartError}
          empty={!charts.data || inventoryTotal(charts.data.inventory) === 0}
          extra={<Link to="/reports/inventory-ageing">{t('dashboard.charts.viewReport')}</Link>}
          table={charts.data && <InventoryTable inventory={charts.data.inventory} />}
          data-testid="chart-inventory"
        >
          {charts.data && <InventoryBar inventory={charts.data.inventory} />}
        </ChartCard>
      </div>

      <ActivityList />
    </Flex>
  );
}
